import { Bot } from '../domain/entities/bot.entity';
import { AutoResponseData } from '../domain/dtos/config.dto';
import { IncomingMessage, OutgoingMessage } from '../domain/dtos/message.dto';
import { MessageQueueService } from './message-queue.service';
import { CooldownService } from './cooldown.service';

/**
 * Service for handling automatic responses based on message patterns
 */
export class AutoResponseService {
  constructor(
    private messageQueue: MessageQueueService,
    private cooldownService: CooldownService
  ) {}

  /**
   * Process an incoming message and find matching auto-responses
   */
  processMessage(bot: Bot, message: IncomingMessage): AutoResponseData | null {
    // Periodic cleanup of expired cooldowns
    this.cooldownService.cleanupExpiredCooldowns();

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
      // Check cooldown (convert seconds to milliseconds)
      const cooldownMs = (matchingResponse.cooldown || 0) * 1000;
      if (this.cooldownService.isOnCooldown(message.from, matchingResponse.pattern, cooldownMs)) {
        console.log(`⏳ Cooldown active for sender "${message.from}" on pattern "${matchingResponse.pattern}" in bot "${bot.name}"`);
        return null;
      }

      // Set cooldown timestamp
      this.cooldownService.setCooldown(message.from, matchingResponse.pattern);

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
