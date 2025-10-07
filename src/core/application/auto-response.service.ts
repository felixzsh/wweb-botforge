import { Bot, AutoResponseData } from '../domain/entities/bot.entity';
import { IncomingMessage, OutgoingMessage } from '../domain/entities/channel.entity';
import { MessageQueueService } from './message-queue.service';

/**
 * Service for handling automatic responses based on message patterns
 */
export class AutoResponseService {
  constructor(private messageQueue: MessageQueueService) {}

  /**
   * Process an incoming message and find matching auto-responses
   */
  processMessage(bot: Bot, message: IncomingMessage): AutoResponseData | null {
    // Skip messages from the bot itself
    if (message.metadata?.fromMe) {
      return null;
    }

    // Skip messages from groups if configured
    if (bot.settings.ignoreGroups && this.isGroupMessage(message.from)) {
      console.log(`🚫 Ignoring group message for bot "${bot.name}"`);
      return null;
    }

    // Find matching auto-response
    const matchingResponse = bot.findMatchingAutoResponse(message.content);

    if (matchingResponse) {
      console.log(`🤖 Auto-response triggered for bot "${bot.name}": "${matchingResponse.pattern}" → "${matchingResponse.response}"`);
      return matchingResponse;
    }

    return null;
  }

  /**
   * Check if a phone number is in the admin list
   */
  isAdminNumber(bot: Bot, phoneNumber: string): boolean {
    return bot.settings.adminNumbers.some(admin =>
      this.normalizePhoneNumber(admin.value) === this.normalizePhoneNumber(phoneNumber)
    );
  }

  /**
   * Check if message should be processed based on bot settings
   */
  shouldProcessMessage(bot: Bot, message: IncomingMessage): boolean {
    // Skip own messages
    if (message.metadata?.fromMe) {
      return false;
    }

    // Check group settings
    if (bot.settings.ignoreGroups && this.isGroupMessage(message.from)) {
      return false;
    }

    // Check admin-only settings (if implemented in future)
    // For now, process all valid messages

    return true;
  }

  /**
   * Get response options for sending the message
   */
  private getResponseMetadata(autoResponse: AutoResponseData): Record<string, any> {
    if (!autoResponse.responseOptions) {
      return {};
    }

    // Convert response options to metadata
    return {
      ...autoResponse.responseOptions,
      // Add any additional metadata needed for the specific channel
    };
  }

  /**
   * Check if a message is from a group
   */
  private isGroupMessage(from: string): boolean {
    return from.includes('g.us');
  }

  /**
   * Normalize phone number for comparison
   */
  private normalizePhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Send an auto-response using the message queue
   */
  sendAutoResponse(
    bot: Bot,
    originalMessage: IncomingMessage,
    autoResponse: AutoResponseData
  ): string {
    try {
      // Create outgoing message
      const outgoingMessage: OutgoingMessage = {
        to: originalMessage.from,
        content: autoResponse.response,
        metadata: this.getResponseMetadata(autoResponse)
      };

      // Queue the response
      const messageId = this.messageQueue.enqueue(
        bot.id.value,
        outgoingMessage.to,
        outgoingMessage.content,
        0, // Default priority
        outgoingMessage.metadata
      );

      console.log(`📋 Auto-response queued for bot "${bot.name}": ${messageId}`);
      return messageId;

    } catch (error) {
      console.error(`❌ Failed to queue auto-response for bot "${bot.name}":`, error);
      throw error;
    }
  }

  /**
   * Log message processing for debugging
   */
  logMessageProcessing(bot: Bot, message: IncomingMessage, matched: boolean, response?: string) {
    const logData = {
      bot: bot.name,
      from: message.from,
      message: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
      matched,
      response: response ? response.substring(0, 50) + (response.length > 50 ? '...' : '') : undefined,
      timestamp: new Date().toISOString()
    };

    if (matched) {
      console.log(`✅ Auto-response: ${JSON.stringify(logData)}`);
    } else {
      console.log(`ℹ️  Message processed: ${JSON.stringify(logData)}`);
    }
  }
}
