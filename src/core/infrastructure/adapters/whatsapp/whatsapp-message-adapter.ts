import { Message as WWebJSMessage } from 'whatsapp-web.js';
import { IncomingMessage } from '../../../domain/value-objects/incoming-message.vo';
import { OutgoingMessage } from '../../../domain/value-objects/outgoing-message.vo';
import { PhoneNumber } from '../../../domain/value-objects/phone-number.vo';
import { WhatsAppUtils } from './whatsapp-types';

/**
 * Adapts WhatsApp Web.js messages to domain messages and vice versa
 * This adapter bridges the infrastructure layer (WhatsApp Web.js) with the domain layer
 */
export class WhatsAppMessageAdapter {
  /**
   * Convert a WhatsApp Web.js message to a domain IncomingMessage value object
   */
  static toDomainMessage(message: WWebJSMessage): IncomingMessage {
    return IncomingMessage.create(
      message.id._serialized,
      new PhoneNumber(WhatsAppUtils.widToPhoneNumber(message.from)),
      new PhoneNumber(WhatsAppUtils.widToPhoneNumber(message.to)),
      message.body,
      new Date(message.timestamp * 1000),
      {
        hasMedia: message.hasMedia,
        type: message.type,
        fromMe: message.fromMe,
        isGroup: (message as any).isGroupMsg || false
      }
    );
  }

  /**
   * Convert a domain OutgoingMessage value object to WhatsApp format
   */
  static toWhatsAppFormat(message: OutgoingMessage): {
    to: string;
    content: string;
    options?: any;
  } {
    return {
      to: WhatsAppUtils.phoneNumberToWid(message.getTo()),
      content: message.getContent(),
      options: message.getMetadata()
    };
  }
}
