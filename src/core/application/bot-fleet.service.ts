import { Bot } from '../domain/entities/bot.entity';
import { IBotFactory } from '../domain/interfaces/bot-factory.interface';
import { ConfigLoaderService } from './config-loader.service';
import { AutoResponseService } from './auto-response.service';
import { MessageQueueService } from './message-queue.service';
import { IChatFactory } from '../domain/interfaces/chat-factory.interface';
import { ChatMessage, IChatClient } from '../domain/entities/chat.entity';

/**
 * Main bot fleet service for BotForge
 * Coordinates all bot operations: loading config, initializing chat clients, and processing messages
 */
export class BotFleetService {
  private bots: Map<string, Bot> = new Map();
  private configLoader: ConfigLoaderService;
  private autoResponseService: AutoResponseService;
  private messageQueueService: MessageQueueService;
  private botFactory: IBotFactory;
  private chatFactory: IChatFactory;
  private isRunning: boolean = false;
  private processedMessages: Map<string, Set<string>> = new Map();

  constructor(botFactory: IBotFactory, chatFactory: IChatFactory) {
    this.botFactory = botFactory;
    this.chatFactory = chatFactory;
    this.configLoader = new ConfigLoaderService();
    this.messageQueueService = new MessageQueueService();
    this.autoResponseService = new AutoResponseService(this.messageQueueService);
  }

  /**
   * Start all bots from configuration
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🤖 Bot Fleet Launcher is already running');
      return;
    }

    try {
      console.log('🚀 Starting chat BotForge...');

      // Load bot configurations
      const botConfigs = await this.configLoader.loadBotConfigurations();

      if (botConfigs.length === 0) {
        console.log('⚠️  No bots configured. Use "npx botforge create-bot" to create your first bot.');
        return;
      }

      // Create and initialize bots
      for (const config of botConfigs) {
        if (!this.configLoader.validateBotConfig(config)) {
          console.error(`❌ Invalid configuration for bot: ${config.name}`);
          continue;
        }

        await this.initializeBot(config);
      }

      this.isRunning = true;
      console.log(`🎉 chat BotForge started successfully with ${this.bots.size} bot(s)!`);
      console.log('💬 Bots are now listening for messages...');

      // Set up graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ Failed to start Bot Fleet Launcher:', error);
      throw error;
    }
  }

  /**
   * Stop all bots and clean up resources
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping chat BotForge...');

    try {
      // Shutdown message queues
      await this.messageQueueService.shutdown();

      // Destroy all chat clients
      await this.chatFactory.destroyAllClients();

      // Clear bot instances
      this.bots.clear();

      // Clear processed messages cache
      this.processedMessages.clear();

      this.isRunning = false;
      console.log('✅ chat BotForge stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping Bot Orchestrator:', error);
      throw error;
    }
  }

  /**
   * Initialize a single bot
   */
  private async initializeBot(config: any): Promise<void> {
    try {
      console.log(`🤖 Initializing bot: ${config.name} (${config.id})`);

      // Create bot entity
      const bot = this.botFactory.createFromConfig(config);
      this.bots.set(bot.id.value, bot);

      // Create chat client for this bot
      const whatsappClient = this.chatFactory.createClient(bot.id.value);

      // Configure message queue for this bot
      this.configureBotQueue(bot);

      // Set up event handlers
      this.setupBotEventHandlers(bot, whatsappClient);

      // Initialize chat client
      await whatsappClient.initialize();

      console.log(`✅ Bot "${bot.name}" initialized and ready`);

    } catch (error) {
      console.error(`❌ Failed to initialize bot "${config.name}":`, error);
      throw error;
    }
  }

  /**
   * Configure message queue for a specific bot
   */
  private configureBotQueue(bot: Bot): void {
    const botId = bot.id.value;

    // Set delay based on bot's typing delay setting (converted to milliseconds)
    const delayMs = bot.settings.typingDelay;
    this.messageQueueService.setBotDelay(botId, delayMs);

    // Set send callback that uses chat client
    this.messageQueueService.setBotSendCallback(botId, async (botId, phoneNumber, message, options) => {
      const chatClient = this.chatFactory.getClient(botId);
      if (!chatClient) {
        throw new Error(`chat client not found for bot ${botId}`);
      }

      await chatClient.sendMessage(phoneNumber, message, options);
    });

    console.log(`📋 Configured message queue for bot "${bot.name}": delay=${delayMs}ms`);
  }

  /**
   * Set up event handlers for a bot
   */
  private setupBotEventHandlers(bot: Bot, chatClient: IChatClient): void {
    // Handle QR codes for authentication
    chatClient.onQRCode((qrCode: string) => {
      console.log(`\n📱 QR Code for bot "${bot.name}":`);
      console.log('Scan this QR code with chat on your phone:');
      // In a real implementation, you might want to display this differently
      // For now, we'll just log it
      console.log(qrCode);
    });

    // Handle successful authentication
    chatClient.onReady(() => {
      console.log(`✅ Bot "${bot.name}" is authenticated and ready!`);
    });

    // Handle incoming messages
    chatClient.onMessage(async (message: ChatMessage) => {
      await this.handleIncomingMessage(bot, message);
    });

    // Handle authentication failures
    chatClient.onAuthFailure((error: Error) => {
      console.error(`❌ Authentication failed for bot "${bot.name}":`, error.message);
    });

    // Handle disconnections
    chatClient.onDisconnected((reason: string) => {
      console.warn(`⚠️  Bot "${bot.name}" disconnected:`, reason);
    });
  }

  /**
   * Handle incoming messages for a bot
   */
  private async handleIncomingMessage(bot: Bot, message: ChatMessage): Promise<void> {
    // Deduplicate messages to prevent processing the same message multiple times
    const botId = bot.id.value;
    if (!this.processedMessages.has(botId)) {
      this.processedMessages.set(botId, new Set());
    }
    const processedSet = this.processedMessages.get(botId)!;
    if (processedSet.has(message.id)) {
      console.log(`⚠️  Skipping duplicate message ${message.id} for bot "${bot.name}"`);
      return;
    }
    processedSet.add(message.id);

    try {
      // Check if message should be processed
      if (!this.autoResponseService.shouldProcessMessage(bot, message)) {
        return;
      }

      // Process auto-response
      const autoResponse = this.autoResponseService.processMessage(bot, message);

      if (autoResponse) {
        // Queue the auto-response (will be sent with delay)
        this.autoResponseService.sendAutoResponse(bot, message, autoResponse);
      }

      // Log the message processing
      this.autoResponseService.logMessageProcessing(
        bot,
        message,
        !!autoResponse,
        autoResponse?.response
      );

    } catch (error) {
      console.error(`❌ Error processing message for bot "${bot.name}":`, error);
    }
  }


  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      console.log('\n🛑 Received shutdown signal...');
      await this.stop();
      process.exit(0);
    };

    // Handle various shutdown signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('SIGUSR2', shutdown); // nodemon restart

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      this.stop().finally(() => process.exit(1));
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      this.stop().finally(() => process.exit(1));
    });
  }

  /**
   * Get status of all bots
   */
  getStatus(): any {
    const botStatuses = Array.from(this.bots.values()).map(bot => {
      const whatsappClient = this.chatFactory.getClient(bot.id.value);
      const session = whatsappClient?.getSession();
      const queueStatus = this.messageQueueService.getBotQueueStatus(bot.id.value);

      return {
        id: bot.id.value,
        name: bot.name,
        status: session?.state || 'unknown',
        phoneNumber: session?.phoneNumber,
        autoResponsesCount: bot.autoResponses.length,
        webhooksCount: bot.webhooks.length,
        queue: {
          size: queueStatus.queueSize,
          delayMs: queueStatus.delayMs,
          isProcessing: queueStatus.isProcessing,
          hasCallback: queueStatus.hasCallback
        }
      };
    });

    const queueStatus = this.messageQueueService.getAllQueuesStatus();

    return {
      isRunning: this.isRunning,
      bots: botStatuses,
      totalBots: botStatuses.length,
      queues: queueStatus
    };
  }

  /**
   * Check if orchestrator is running
   */
  isRunningStatus(): boolean {
    return this.isRunning;
  }
}
