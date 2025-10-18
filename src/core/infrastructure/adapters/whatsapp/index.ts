/**
 * WhatsApp Infrastructure Module
 * 
 * This module provides a clean abstraction layer over whatsapp-web.js
 * following Clean Architecture principles.
 */

// Export domain interfaces that this infrastructure implements
export { IMessageChannel } from '../../../domain/ports/imessage-channel';
export { IncomingMessage } from '../../../domain/value-objects/incoming-message.vo';
export { OutgoingMessage } from '../../../domain/value-objects/outgoing-message.vo';

// Export WhatsApp infrastructure components
export { WhatsAppChannel } from './whatsapp-channel';
export { WhatsAppInitializer } from './whatsapp-initializer';
export { WhatsAppSessionManager } from './whatsapp-session-manager';
export { WhatsAppMessageAdapter } from './whatsapp-message-adapter';

// Export WhatsApp-specific types and utilities
export { 
  WhatsAppUtils, 
  WhatsAppMessageType, 
  WhatsAppMessageOptions,
  WhatsAppMediaInfo,
  WhatsAppContact,
  WhatsAppGroup
} from './whatsapp-types';

// Export types for initialization and authentication
export { 
  QRCodeHandler, 
  AuthSuccessHandler, 
  AuthFailureHandler 
} from './whatsapp-initializer';
