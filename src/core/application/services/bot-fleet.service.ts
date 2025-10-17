import { Bot } from '../../domain/entities/bot.entity';
import { AutoResponseService } from './auto-response.service';
import { CooldownService } from './cooldown.service';
import { WebhookService } from './webhook.service';
import { MessageQueueService } from './message-queue.service';
import { MessageHandlerService } from './message-handler.service';
import { IChannelManager } from '../../domain/ports/channel-manager';
import { ConfigFileDTO } from '../dtos/config-file.dto';
import { getLogger } from '../../infrastructure/logger';
import { loadBotsFromConfig } from '../use-cases/load-bots.use-case';

/**
 * Main bot fleet service for WWeb BotForge
 * Coordinates all bot operations: loading config, initializing channels, and processing messages
 */
export class BotFleetService {
  private bots: Map<string, Bot> = new Map();
  private autoResponseService: AutoResponseService;
  private cooldownService: CooldownService;
  private webhookService: WebhookService;
  private messageQueueService: MessageQueueService;
  private messageHandlerService: MessageHandlerService;
  private channelManager: IChannelManager;
  private isRunning: boolean = false;

  constructor(
    channelManager: IChannelManager,
    messageQueueService: MessageQueueService
  ) {
    this.channelManager = channelManager;
    this.messageQueueService = messageQueueService;
    this.cooldownService = new CooldownService();
    this.autoResponseService = new AutoResponseService(this.messageQueueService, this.cooldownService);
    this.webhookService = new WebhookService(this.cooldownService);
    this.messageHandlerService = new MessageHandlerService(this.autoResponseService, this.webhookService);
  }

  private get logger() {
    return getLogger();
  }

  /**
    * Start all bots from configuration
    */
   async start(configFile: ConfigFileDTO): Promise<Map<string, Bot>> {
    if (this.isRunning) {
      this.logger.info('🤖 Bot Fleet Launcher is already running');
      return this.bots;
    }

    try {
      this.logger.info('🚀 Starting WWeb BotForge...');

      if (configFile.bots.length === 0) {
        this.logger.warn('⚠️  No bots configured. Use "npx botforge create-bot" to create your first bot.');
        return this.bots;
      }

      // Load bots from configuration
      const loadedBots = await loadBotsFromConfig(configFile.bots);

      // Create and initialize bots with delays to avoid conflicts
      for (const bot of loadedBots) {
        await this.initializeBot(bot);

        // Add delay between bot initializations to prevent resource conflicts
        if (loadedBots.length > 1) {
          this.logger.info('⏳ Waiting 3 seconds before initializing next bot...');
          await this.delay(3000);
        }
      }

      this.isRunning = true;
      this.logger.info(`🎉 WWeb BotForge started successfully with ${this.bots.size} bot(s)!`);
      this.logger.info('💬 Bots are now listening for messages...');

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      return this.bots;

    } catch (error) {
      this.logger.error('❌ Failed to start Bot Fleet Launcher:', error);
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

   this.logger.info('🛑 Stopping WWeb BotForge...');

   try {
     // Shutdown message queues
     await this.messageQueueService.shutdown();

     // Destroy all channels
     await this.channelManager.removeAllChannels();

     // Clear bot instances
     this.bots.clear();


     this.isRunning = false;
     this.logger.info('✅ WWeb BotForge stopped successfully');
   } catch (error) {
     this.logger.error('❌ Error stopping Bot Fleet:', error);
     throw error;
   }
 }

  /**
   * Initialize a single bot
   */
  private async initializeBot(bot: Bot): Promise<void> {
   try {
     this.logger.info(`🤖 Initializing bot: ${bot.name} (${bot.id.value})`);

     this.bots.set(bot.id.value, bot);

     // Create message channel for this bot
     const channel = this.channelManager.createChannel(bot.id.value);

     // Register channel with bot
     bot.registerChannel(channel);

     // Configure message queue for this bot
     this.messageQueueService.setupBotQueue(bot);

     // Register bot with message handler service
     this.messageHandlerService.registerBot(bot);

     // Set up event handlers
     this.setupBotEventHandlers(bot);

     // Initialize channel
     await bot.channel!.connect();

     this.logger.info(`✅ Bot "${bot.name}" initialized and ready`);

   } catch (error) {
     this.logger.error(`❌ Failed to initialize bot "${bot.name}":`, error);
     throw error;
   }
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
       this.logger.info(`✅ Bot "${bot.name}" is ready!`);
     });

     // Handle disconnections
     bot.channel.onDisconnected((reason: string) => {
       this.logger.warn(`⚠️  Bot "${bot.name}" disconnected:`, reason);
     });

     // Handle auth failures
     bot.channel.onAuthFailure((error: Error) => {
       this.logger.error(`❌ Bot "${bot.name}" authentication failed:`, error.message);
     });

     // Handle connection errors
     bot.channel.onConnectionError((error: Error) => {
       this.logger.error(`❌ Bot "${bot.name}" connection error:`, error.message);
     });

     // Handle state changes
     bot.channel.onStateChange((state: string) => {
       this.logger.info(`ℹ️  Bot "${bot.name}" state changed to:`, state);
     });
   }


  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
   const shutdown = async () => {
     this.logger.info('\n🛑 Received shutdown signal...');
     await this.stop();
     process.exit(0);
   };

   // Handle various shutdown signals
   process.on('SIGINT', shutdown);
   process.on('SIGTERM', shutdown);
   process.on('SIGUSR2', shutdown); // nodemon restart

   // Handle uncaught exceptions
   process.on('uncaughtException', (error) => {
     this.logger.error('❌ Uncaught Exception:', error);
     this.stop().finally(() => process.exit(1));
   });

   // Handle unhandled promise rejections
   process.on('unhandledRejection', (reason, promise) => {
     this.logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
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
