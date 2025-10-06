/**
 * WhatsApp Infrastructure Module
 * 
 * This module provides a clean abstraction layer over whatsapp-web.js
 * following Clean Architecture principles.
 */

export { IChatClient as IWhatsAppClient, IChatSessionManager as IWhatsAppSessionManager, ChatClientState as WhatsAppClientState, ChatMessage as WhatsAppMessage, ChatSession as WhatsAppSession } from '../../domain/entities/chat.entity';
export { WhatsAppClient } from './whatsapp-client';
export { WhatsAppSessionManager } from './whatsapp-session-manager';
export { ChatMessageHandler } from './whatsapp-message-handler';
export { WhatsAppFactory } from './whatsapp-factory';
export { WhatsAppUtils, WhatsAppMessageType, WhatsAppConnectionState, WhatsAppMessageOptions } from './whatsapp-types';
