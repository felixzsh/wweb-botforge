/**
 * WhatsApp Infrastructure Module
 * 
 * This module provides a clean abstraction layer over whatsapp-web.js
 * following Clean Architecture principles.
 */

export { IWhatsAppClient, IWhatsAppSessionManager, WhatsAppClientState, WhatsAppMessage, WhatsAppSession } from '../../domain/interfaces/i-whatsapp-client.interface';
export { WhatsAppClient } from './whatsapp-client';
export { WhatsAppSessionManager } from './whatsapp-session-manager';
export { WhatsAppMessageHandler } from './whatsapp-message-handler';
export { WhatsAppFactory } from './whatsapp-factory';
export { WhatsAppUtils, WhatsAppMessageType, WhatsAppConnectionState, WhatsAppMessageOptions } from './whatsapp-types';