import { Bot } from '../domain/entities/bot.entity';
import { BotFactory } from '../infrastructure/bot-factory';
import { ConfigLoaderService } from './config-loader.service';
import { AutoResponseService } from './auto-response.service';
import { WhatsAppFactory } from '../infrastructure/whatsapp';
import { WhatsAppMessage, IWhatsAppClient } from '../domain/interfaces/i-whatsapp-client.interface';

/**
 * Main orchestrator service for WhatsApp BotForge
 * Coordinates all bot operations: loading config, initializing clients, and processing messages
 */
export class BotOrchestratorService {
  private bots: Map<string, Bot> = new Map();
  private configLoader: ConfigLoaderService;
  private autoResponseService: AutoResponseService;
  private botFactory: BotFactory;
  private isRunning: boolean = false;

  constructor() {
    this.configLoader = new ConfigLoaderService();
    this.autoResponseService = new AutoResponseService();
    this.botFactory = new BotFactory();
  }

  /**
   * Start all bots from configuration
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🤖 Bot Orchestrator is already running');
      return;
    }

    try {
      console.log('🚀 Starting WhatsApp BotForge...');

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
      console.log(`🎉 WhatsApp BotForge started successfully with ${this.bots.size} bot(s)!`);
      console.log('💬 Bots are now listening for messages...');

      // Set up graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ Failed to start Bot Orchestrator:', error);
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

    console.log('🛑 Stopping WhatsApp BotForge...');

    try {
      // Destroy all WhatsApp clients
      await WhatsAppFactory.destroyAllClients();

      // Clear bot instances
      this.bots.clear();

      this.isRunning = false;
      console.log('✅ WhatsApp BotForge stopped successfully');
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

      // Create WhatsApp client for this bot
      const whatsappClient = WhatsAppFactory.createClient(bot.id.value);

      // Set up event handlers
      this.setupBotEventHandlers(bot, whatsappClient);

      // Initialize WhatsApp client
      await whatsappClient.initialize();

      console.log(`✅ Bot "${bot.name}" initialized and ready`);

    } catch (error) {
      console.error(`❌ Failed to initialize bot "${config.name}":`, error);
      throw error;
    }
  }

  /**
   * Set up event handlers for a bot
   */
  private setupBotEventHandlers(bot: Bot, whatsappClient: IWhatsAppClient): void {
    // Handle QR codes for authentication
    whatsappClient.onQRCode((qrCode: string) => {
      console.log(`\n📱 QR Code for bot "${bot.name}":`);
      console.log('Scan this QR code with WhatsApp on your phone:');
      // In a real implementation, you might want to display this differently
      // For now, we'll just log it
      console.log(qrCode);
    });

    // Handle successful authentication
    whatsappClient.onReady(() => {
      console.log(`✅ Bot "${bot.name}" is authenticated and ready!`);
    });

    // Handle incoming messages
    whatsappClient.onMessage(async (message: WhatsAppMessage) => {
      await this.handleIncomingMessage(bot, message);
    });

    // Handle authentication failures
    whatsappClient.onAuthFailure((error: Error) => {
      console.error(`❌ Authentication failed for bot "${bot.name}":`, error.message);
    });

    // Handle disconnections
    whatsappClient.onDisconnected((reason: string) => {
      console.warn(`⚠️  Bot "${bot.name}" disconnected:`, reason);
    });
  }

  /**
   * Handle incoming messages for a bot
   */
  private async handleIncomingMessage(bot: Bot, message: WhatsAppMessage): Promise<void> {
    try {
      // Check if message should be processed
      if (!this.autoResponseService.shouldProcessMessage(bot, message)) {
        return;
      }

      // Process auto-response
      const autoResponse = this.autoResponseService.processMessage(bot, message);

      if (autoResponse) {
        // Send the auto-response
        await this.sendAutoResponse(bot, message, autoResponse);
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
   * Send an auto-response
   */
  private async sendAutoResponse(
    bot: Bot,
    originalMessage: WhatsAppMessage,
    autoResponse: any
  ): Promise<void> {
    try {
      // Get WhatsApp client for this bot
      const whatsappClient = WhatsAppFactory.getClient(bot.id.value);

      if (!whatsappClient) {
        console.error(`❌ WhatsApp client not found for bot "${bot.name}"`);
        return;
      }

      // Prepare response options
      const responseOptions = this.autoResponseService.getResponseOptions(autoResponse);

      // Send the response
      const messageId = await whatsappClient.sendMessage(
        originalMessage.from,
        autoResponse.response,
        responseOptions
      );

      console.log(`📤 Auto-response sent by "${bot.name}": ${messageId}`);

    } catch (error) {
      console.error(`❌ Failed to send auto-response for bot "${bot.name}":`, error);
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
      const whatsappClient = WhatsAppFactory.getClient(bot.id.value);
      const session = whatsappClient?.getSession();

      return {
        id: bot.id.value,
        name: bot.name,
        status: session?.state || 'unknown',
        phoneNumber: session?.phoneNumber,
        autoResponsesCount: bot.autoResponses.length,
        webhooksCount: bot.webhooks.length
      };
    });

    return {
      isRunning: this.isRunning,
      bots: botStatuses,
      totalBots: botStatuses.length
    };
  }

  /**
   * Check if orchestrator is running
   */
  isRunningStatus(): boolean {
    return this.isRunning;
  }
}