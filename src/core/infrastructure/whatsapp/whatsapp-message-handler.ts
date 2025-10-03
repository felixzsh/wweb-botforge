import { Bot } from '../../domain/entities/bot.entity';
import { IWhatsAppClient, WhatsAppMessage } from '../../domain/interfaces/i-whatsapp-client.interface';

/**
 * Callback type for handling processed messages
 */
export type MessageHandlerCallback = (bot: Bot, message: WhatsAppMessage, response?: string) => void;

/**
 * Handles incoming WhatsApp messages and routes them to the appropriate bot logic
 * This class bridges the gap between WhatsApp infrastructure and domain logic
 */
export class WhatsAppMessageHandler {
  private bots: Map<string, Bot> = new Map();
  private messageHandlers: Map<string, MessageHandlerCallback> = new Map();

  /**
   * Register a bot with its WhatsApp client
   */
  registerBot(bot: Bot, whatsappClient: IWhatsAppClient): void {
    this.bots.set(bot.id.value, bot);
    
    // Set up message listener for this bot
    whatsappClient.onMessage((message: WhatsAppMessage) => {
      this.handleIncomingMessage(bot, message);
    });

    // Set up ready listener to log when bot is ready
    whatsappClient.onReady(() => {
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
   * Handle incoming message from WhatsApp
   */
  private async handleIncomingMessage(bot: Bot, message: WhatsAppMessage): Promise<void> {
    // Skip messages from the bot itself
    if (message.fromMe) {
      return;
    }

    console.log(`📨 Message received for bot "${bot.name}": ${message.body.substring(0, 50)}...`);

    try {
      // First, check for auto-responses
      const autoResponse = bot.findMatchingAutoResponse(message.body);
      if (autoResponse) {
        await this.handleAutoResponse(bot, message, autoResponse);
        return;
      }

      // Then, check for webhooks
      const webhook = bot.findMatchingWebhook(message.body);
      if (webhook) {
        await this.handleWebhook(bot, message, webhook);
        return;
      }

      // If no auto-response or webhook matches, call custom handler if registered
      const customHandler = this.messageHandlers.get(bot.id.value);
      if (customHandler) {
        customHandler(bot, message);
      }

    } catch (error) {
      console.error(`❌ Error handling message for bot "${bot.name}":`, error);
    }
  }

  /**
   * Handle auto-response logic
   */
  private async handleAutoResponse(bot: Bot, message: WhatsAppMessage, autoResponse: any): Promise<void> {
    console.log(`🤖 Auto-response triggered for bot "${bot.name}": ${autoResponse.pattern}`);

    // Get the WhatsApp client for this bot
    const botId = bot.id.value;
    const customHandler = this.messageHandlers.get(botId);
    
    if (customHandler) {
      // Let the custom handler process the auto-response
      customHandler(bot, message, autoResponse.response);
    } else {
      // Default behavior: send the auto-response
      // Note: In a real implementation, we would need access to the WhatsApp client
      // This would be handled by the application layer
      console.log(`📤 Would send auto-response: "${autoResponse.response}"`);
    }
  }

  /**
   * Handle webhook logic
   */
  private async handleWebhook(bot: Bot, message: WhatsAppMessage, webhook: any): Promise<void> {
    console.log(`🌐 Webhook triggered for bot "${bot.name}": ${webhook.name}`);

    // In a real implementation, this would make an HTTP request to the webhook URL
    // For now, just log the webhook details
    console.log(`📡 Webhook details:`, {
      name: webhook.name,
      url: webhook.url,
      method: webhook.method,
      pattern: webhook.pattern
    });

    // Call custom handler if registered
    const customHandler = this.messageHandlers.get(bot.id.value);
    if (customHandler) {
      customHandler(bot, message);
    }
  }

  /**
   * Send a message through a bot's WhatsApp client
   * This method would be called by the application layer
   */
  async sendMessage(botId: string, to: string, message: string, options?: any): Promise<string> {
    const bot = this.bots.get(botId);
    if (!bot) {
      throw new Error(`Bot with ID "${botId}" not found`);
    }

    // Note: In a complete implementation, we would have access to the WhatsApp client
    // This would be provided by the application layer that coordinates between
    // the message handler and the session manager
    console.log(`📤 Would send message from bot "${bot.name}" to ${to}: ${message}`);
    
    // Return a mock message ID for now
    return `mock-${Date.now()}`;
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