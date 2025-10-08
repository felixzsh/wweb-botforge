import { Bot } from '../domain/entities/bot.entity';
import { IncomingMessage, OutgoingMessage } from '../domain/dtos/message.dto';
import { AutoResponseService } from './auto-response.service';

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

  constructor(autoResponseService: AutoResponseService) {
    this.autoResponseService = autoResponseService;
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
       console.log(`🤖 Bot "${bot.name}" (${bot.id.value}) is ready and listening for messages`);
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
    console.log(`📨 Message received for bot "${bot.name}": ${message.content.substring(0, 50)}...`);

    try {
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
      console.error(`❌ Error handling message for bot "${bot.name}":`, error);
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
}