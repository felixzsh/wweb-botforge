import { Bot } from '../domain/entities/bot.entity';
import { IncomingMessage, OutgoingMessage } from '../domain/dtos/message.dto';
import { AutoResponseService } from './auto-response.service';
import { WebhookService } from './webhook.service';
import { getLogger } from '../infrastructure/logger';

/**
 * Callback type for handling processed messages
 */
export type MessageHandlerCallback = (bot: Bot, message: IncomingMessage, response?: string) => void;

/**
 * Handles incoming chat messages and routes them to the appropriate bot logic
 * This class bridges the gap between chat infrastructure and domain logic
 */
export class MessageHandlerService {
  private bots: Map<string, Bot> = new Map();
  private messageHandlers: Map<string, MessageHandlerCallback> = new Map();
  private autoResponseService: AutoResponseService;
  private webhookService: WebhookService;

  constructor(autoResponseService: AutoResponseService, webhookService: WebhookService) {
    this.autoResponseService = autoResponseService;
    this.webhookService = webhookService;
  }

  private get logger() {
    return getLogger();
  }

  /**
    * Register a bot with its message channel
    */
   registerBot(bot: Bot): void {
     if (!bot.channel) {
       throw new Error(`Bot "${bot.name}" does not have a registered channel`);
     }

     this.bots.set(bot.id.value, bot);

     // Set up message listener for this bot
     bot.channel.onMessage((message: IncomingMessage) => {
       this.handleIncomingMessage(bot, message);
     });

     // Set up ready listener to log when bot is ready
     bot.channel.onReady(() => {
       this.logger.info(`🤖 Bot "${bot.name}" (${bot.id.value}) is ready and listening for messages`);
     });
   }

  /**
   * Unregister a bot
   */
  unregisterBot(botId: string): void {
    this.bots.delete(botId);
    this.messageHandlers.delete(botId);
  }

  /**
   * Register a custom message handler for a specific bot
   */
  registerMessageHandler(botId: string, handler: MessageHandlerCallback): void {
    this.messageHandlers.set(botId, handler);
  }

  /**
    * Handle incoming message from chat
    */
  private async handleIncomingMessage(bot: Bot, message: IncomingMessage): Promise<void> {
    this.logger.info(`📨 Message received for bot "${bot.name}": ${message.content.substring(0, 50)}...`);

    try {
      // Check if sender is in ignored senders list
      if (this.isSenderIgnored(bot, message.from)) {
        this.logger.debug(`🚫 Ignoring message from "${message.from}" for bot "${bot.name}" (sender in ignored list)`);
        return;
      }

      // Check if message should be processed
      if (!this.autoResponseService.shouldProcessMessage(bot, message)) {
        return;
      }

      // Process auto-response
      const autoResponse = this.autoResponseService.processMessage(bot, message);

      if (autoResponse) {
        // Send auto-response
        this.autoResponseService.sendAutoResponse(bot, message, autoResponse);
      }

      // Process webhooks (async, don't wait)
      this.webhookService.processWebhooks(bot, message).catch(error => {
        this.logger.error(`❌ Error processing webhooks for bot "${bot.name}":`, error);
      });

      // Log the message processing
      this.autoResponseService.logMessageProcessing(
        bot,
        message,
        !!autoResponse,
        autoResponse?.response
      );

      // Call custom handler if registered
      const customHandler = this.messageHandlers.get(bot.id.value);
      if (customHandler) {
        customHandler(bot, message, autoResponse?.response);
      }

    } catch (error) {
      this.logger.error(`❌ Error handling message for bot "${bot.name}":`, error);
    }
  }


  /**
   * Get all registered bots
   */
  getRegisteredBots(): Bot[] {
    return Array.from(this.bots.values());
  }

  /**
   * Check if a bot is registered
   */
  isBotRegistered(botId: string): boolean {
    return this.bots.has(botId);
  }

  /**
    * Get bot by ID
    */
  getBot(botId: string): Bot | undefined {
    return this.bots.get(botId);
  }

  /**
    * Check if sender is in the ignored senders list
    */
  private isSenderIgnored(bot: Bot, sender: string): boolean {
    return bot.settings.ignoredSenders.includes(sender);
  }
}
