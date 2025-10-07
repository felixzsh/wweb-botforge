import { Bot } from '../domain/entities/bot.entity';
import { IBotFactory } from '../domain/interfaces/bot-factory.interface';
import { ConfigLoaderService } from './config-loader.service';
import { AutoResponseService } from './auto-response.service';
import { MessageQueueService } from './message-queue.service';
import { MessageHandlerService } from './message-handler.service';
import { MessageChannel, IncomingMessage, OutgoingMessage } from '../domain/entities/channel.entity';
import { IChannelManager } from '../domain/interfaces/channel-manager.interface';

/**
 * Main bot fleet service for BotForge
 * Coordinates all bot operations: loading config, initializing channels, and processing messages
 */
export class BotFleetService {
  private bots: Map<string, Bot> = new Map();
  private configLoader: ConfigLoaderService;
  private autoResponseService: AutoResponseService;
  private messageQueueService: MessageQueueService;
  private messageHandlerService: MessageHandlerService;
  private botFactory: IBotFactory;
  private channelManager: IChannelManager;
  private isRunning: boolean = false;

  constructor(
    botFactory: IBotFactory,
    channelManager: IChannelManager
  ) {
    this.botFactory = botFactory;
    this.channelManager = channelManager;
    this.configLoader = new ConfigLoaderService();
    this.messageQueueService = new MessageQueueService();
    this.autoResponseService = new AutoResponseService(this.messageQueueService);
    this.messageHandlerService = new MessageHandlerService(this.autoResponseService);
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

      // Create and initialize bots with delays to avoid conflicts
      for (const config of botConfigs) {
        if (!this.configLoader.validateBotConfig(config)) {
          console.error(`❌ Invalid configuration for bot: ${config.name}`);
          continue;
        }

        await this.initializeBot(config);

        // Add delay between bot initializations to prevent resource conflicts
        if (botConfigs.length > 1) {
          console.log('⏳ Waiting 3 seconds before initializing next bot...');
          await this.delay(3000);
        }
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

      // Destroy all channels
      await this.channelManager.removeAllChannels();

      // Clear bot instances
      this.bots.clear();


      this.isRunning = false;
      console.log('✅ chat BotForge stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping Bot Fleet:', error);
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

      // Create message channel for this bot
      const channel = this.channelManager.createChannel(bot.id.value);

      // Register channel with bot
      bot.registerChannel(channel);

      // Configure message queue for this bot
      this.configureBotQueue(bot);

      // Register bot with message handler service
      this.messageHandlerService.registerBot(bot);

      // Set up event handlers
      this.setupBotEventHandlers(bot);

      // Initialize channel
      await bot.channel!.connect();

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
     if (!bot.channel) {
       throw new Error(`Bot "${bot.name}" does not have a registered channel`);
     }

     const botId = bot.id.value;

     // Set delay based on bot's typing delay setting
     const delayMs = bot.settings.typingDelay;
     this.messageQueueService.setBotDelay(botId, delayMs);

     // Set send callback that uses message channel
     this.messageQueueService.setBotSendCallback(botId, async (botId: string, message: OutgoingMessage) => {
       await bot.channel!.send(message);
     });

     console.log(`📋 Configured message queue for bot "${bot.name}": delay=${delayMs}ms`);
   }

  /**
    * Set up event handlers for a bot
    */
   private setupBotEventHandlers(bot: Bot): void {
     if (!bot.channel) {
       throw new Error(`Bot "${bot.name}" does not have a registered channel`);
     }

     // Handle ready event
     bot.channel.onReady(() => {
       console.log(`✅ Bot "${bot.name}" is ready!`);
     });

     // Handle disconnections
     bot.channel.onDisconnected((reason: string) => {
       console.warn(`⚠️  Bot "${bot.name}" disconnected:`, reason);
     });

     // Handle auth failures
     bot.channel.onAuthFailure((error: Error) => {
       console.error(`❌ Bot "${bot.name}" authentication failed:`, error.message);
     });

     // Handle connection errors
     bot.channel.onConnectionError((error: Error) => {
       console.error(`❌ Bot "${bot.name}" connection error:`, error.message);
     });

     // Handle state changes
     bot.channel.onStateChange((state: string) => {
       console.log(`ℹ️  Bot "${bot.name}" state changed to:`, state);
     });
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
      const queueStatus = this.messageQueueService.getBotQueueStatus(bot.id.value);

      return {
        id: bot.id.value,
        name: bot.name,
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
   * Check if fleet is running
   */
  isRunningStatus(): boolean {
    return this.isRunning;
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
