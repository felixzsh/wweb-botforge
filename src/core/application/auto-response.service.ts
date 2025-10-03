import { Bot, AutoResponseData } from '../domain/entities/bot.entity';
import { WhatsAppMessage } from '../domain/interfaces/i-whatsapp-client.interface';
import { MessageQueueService } from './message-queue.service';

/**
 * Service for handling automatic responses based on message patterns
 */
export class AutoResponseService {
  constructor(private messageQueue: MessageQueueService) {}

  /**
   * Process an incoming message and find matching auto-responses
   */
  processMessage(bot: Bot, message: WhatsAppMessage): AutoResponseData | null {
    // Skip messages from the bot itself
    if (message.fromMe) {
      return null;
    }

    // Skip messages from groups if configured
    if (bot.settings.ignoreGroups && message.from.includes('@g.us')) {
      console.log(`🚫 Ignoring group message for bot "${bot.name}"`);
      return null;
    }

    // Find matching auto-response
    const matchingResponse = bot.findMatchingAutoResponse(message.body);

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
  shouldProcessMessage(bot: Bot, message: WhatsAppMessage): boolean {
    // Skip own messages
    if (message.fromMe) {
      return false;
    }

    // Check group settings
    if (bot.settings.ignoreGroups && message.from.includes('@g.us')) {
      return false;
    }

    // Check admin-only settings (if implemented in future)
    // For now, process all valid messages

    return true;
  }

  /**
   * Get response options for sending the message
   */
  getResponseOptions(autoResponse: AutoResponseData) {
    if (!autoResponse.responseOptions) {
      return {};
    }

    return {
      linkPreview: autoResponse.responseOptions.linkPreview,
      sendAudioAsVoice: autoResponse.responseOptions.sendAudioAsVoice,
      sendVideoAsGif: autoResponse.responseOptions.sendVideoAsGif,
      sendMediaAsSticker: autoResponse.responseOptions.sendMediaAsSticker,
      sendMediaAsDocument: autoResponse.responseOptions.sendMediaAsDocument,
      sendMediaAsHd: autoResponse.responseOptions.sendMediaAsHd,
      isViewOnce: autoResponse.responseOptions.isViewOnce,
      parseVCards: autoResponse.responseOptions.parseVCards,
      caption: autoResponse.responseOptions.caption,
      quotedMessageId: autoResponse.responseOptions.quotedMessageId,
      groupMentions: autoResponse.responseOptions.groupMentions,
      mentions: autoResponse.responseOptions.mentions,
      sendSeen: autoResponse.responseOptions.sendSeen,
      invokedBotWid: autoResponse.responseOptions.invokedBotWid,
      stickerAuthor: autoResponse.responseOptions.stickerAuthor,
      stickerName: autoResponse.responseOptions.stickerName,
      stickerCategories: autoResponse.responseOptions.stickerCategories,
      ignoreQuoteErrors: autoResponse.responseOptions.ignoreQuoteErrors,
      waitUntilMsgSent: autoResponse.responseOptions.waitUntilMsgSent,
      media: autoResponse.responseOptions.media
    };
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
    originalMessage: WhatsAppMessage,
    autoResponse: any
  ): string {
    try {
      // Prepare response options
      const responseOptions = this.getResponseOptions(autoResponse);

      // Queue the response instead of sending directly
      const messageId = this.messageQueue.enqueue(
        bot.id.value,
        originalMessage.from,
        autoResponse.response,
        0, // Default priority
        responseOptions
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
  logMessageProcessing(bot: Bot, message: WhatsAppMessage, matched: boolean, response?: string) {
    const logData = {
      bot: bot.name,
      from: message.from,
      message: message.body.substring(0, 50) + (message.body.length > 50 ? '...' : ''),
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
