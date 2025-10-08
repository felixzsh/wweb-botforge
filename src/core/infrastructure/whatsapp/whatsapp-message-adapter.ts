import { Message as WWebJSMessage } from 'whatsapp-web.js';
import { IncomingMessage, OutgoingMessage } from '../../domain/dtos/message.dto';
import { WhatsAppUtils } from './whatsapp-types';

/**
 * Adapts WhatsApp Web.js messages to domain messages and vice versa
 */
export class WhatsAppMessageAdapter {
  /**
   * Convert a WhatsApp Web.js message to a domain IncomingMessage
   */
  static toDomainMessage(message: WWebJSMessage): IncomingMessage {
    return {
      id: message.id._serialized,
      from: WhatsAppUtils.widToPhoneNumber(message.from),
      to: WhatsAppUtils.widToPhoneNumber(message.to),
      content: message.body,
      timestamp: new Date(message.timestamp * 1000),
      metadata: {
        hasMedia: message.hasMedia,
        type: message.type,
        fromMe: message.fromMe
      }
    };
  }

  /**
   * Convert a domain OutgoingMessage to WhatsApp format
   */
  static toWhatsAppFormat(message: OutgoingMessage): {
    to: string;
    content: string;
    options?: any;
  } {
    return {
      to: WhatsAppUtils.phoneNumberToWid(message.to),
      content: message.content,
      options: message.metadata
    };
  }
}