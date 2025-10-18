import { Bot } from '../../domain/entities/bot.entity';
import { AutoResponse } from '../../domain/value-objects/auto-response.vo';
import { IncomingMessage } from '../../domain/value-objects/incoming-message.vo';
import { OutgoingMessage } from '../../domain/value-objects/outgoing-message.vo';
import { MessageQueueService } from './message-queue.service';
import { CooldownService } from './cooldown.service';
import { getLogger } from '../../infrastructure/utils/logger';

/**
 * Service for handling automatic responses based on message patterns
 */
export class AutoResponseService {
  constructor(
    private messageQueue: MessageQueueService,
    private cooldownService: CooldownService
  ) {}

  private get logger() {
    return getLogger();
  }

  /**
   * Process an incoming message and find matching auto-responses
   */
  processMessage(bot: Bot, message: IncomingMessage): AutoResponse | null {
    // Periodic cleanup of expired cooldowns
    this.cooldownService.cleanupExpiredCooldowns();

    // Skip messages from the bot itself
    if (message.metadata?.fromMe) {
      return null;
    }

    // Skip messages from groups if configured
    if (bot.settings.ignoreGroups && this.isGroupMessage(message.from.getValue())) {
      this.logger.debug(`🚫 Ignoring group message for bot "${bot.name}"`);
      return null;
    }

    // Find matching auto-response
    const matchingResponse = bot.findMatchingAutoResponse(message.content);

    if (matchingResponse) {
      // Check cooldown (convert seconds to milliseconds)
      const cooldownMs = (matchingResponse.cooldown || 0) * 1000;
      const patternKey = matchingResponse.pattern.getPattern();
      if (this.cooldownService.isOnCooldown(message.from.getValue(), patternKey, cooldownMs)) {
        this.logger.debug(`⏳ Cooldown active for sender "${message.from.getValue()}" on pattern "${patternKey}" in bot "${bot.name}"`);
        return null;
      }

      // Set cooldown timestamp
      this.cooldownService.setCooldown(message.from.getValue(), patternKey);

      this.logger.info(`🤖 Auto-response triggered for bot "${bot.name}": "${patternKey}" → "${matchingResponse.response}"`);
      return matchingResponse;
    }

    return null;
  }

  /**
   * Check if a phone number is in the admin list
   */
  isAdminNumber(bot: Bot, phoneNumber: string): boolean {
    return bot.settings.adminNumbers.some(admin =>
      this.normalizePhoneNumber(admin) === this.normalizePhoneNumber(phoneNumber)
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
    if (bot.settings.ignoreGroups && this.isGroupMessage(message.from.getValue())) {
      return false;
    }

    // Check admin-only settings (if implemented in future)
    // For now, process all valid messages

    return true;
  }

  /**
   * Get response options for sending the message
   */
  private getResponseMetadata(autoResponse: AutoResponse): Record<string, any> {
    return autoResponse.responseOptions || {};
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
    autoResponse: AutoResponse
  ): string {
    try {
      // Create outgoing message using Value Object directly
      const outgoingMessage = OutgoingMessage.create(
        originalMessage.from.getValue(),
        autoResponse.response,
        this.getResponseMetadata(autoResponse)
      );

      // Queue the message
      const messageId = this.messageQueue.enqueue(bot.id.value, originalMessage.from.getValue(), autoResponse.response);

      this.logger.info(`📤 Auto-response queued for bot "${bot.name}" with ID: ${messageId}`);
      return messageId;
    } catch (error) {
      this.logger.error(`❌ Error sending auto-response for bot "${bot.name}":`, error);
      throw error;
    }
  }
}
