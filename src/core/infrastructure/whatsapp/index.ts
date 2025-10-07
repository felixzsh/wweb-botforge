/**
 * WhatsApp Infrastructure Module
 * 
 * This module provides a clean abstraction layer over whatsapp-web.js
 * following Clean Architecture principles.
 */

// Export domain interfaces that this infrastructure implements
export { MessageChannel, IncomingMessage, OutgoingMessage } from '../../domain/entities/channel.entity';

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
