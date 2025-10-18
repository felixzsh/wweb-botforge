/**
 * WhatsApp-specific types and utilities
 * This file contains types that bridge the gap between whatsapp-web.js and our domain
 */

/**
 * WhatsApp message types supported by the system
 */
export enum WhatsAppMessageType {
  TEXT = 'chat',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  LOCATION = 'location',
  CONTACT = 'contact',
  BUTTONS_RESPONSE = 'buttons_response',
  LIST_RESPONSE = 'list_response',
  TEMPLATE_BUTTON_REPLY = 'template_button_reply'
}

/**
 * WhatsApp connection states
 */
export enum WhatsAppConnectionState {
  CONNECTING = 'CONNECTING',
  AUTHENTICATING = 'AUTHENTICATING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  FAILED = 'FAILED'
}

/**
 * WhatsApp session information
 */
export interface WhatsAppSessionInfo {
  clientId: string;
  phoneNumber?: string;
  platform?: string;
  pushname?: string;
  wid?: string;
  connected: boolean;
  lastSeen?: Date;
}

/**
 * WhatsApp message send options
 * Maps to whatsapp-web.js MessageSendOptions
 */
export interface WhatsAppMessageOptions {
  linkPreview?: boolean;
  sendAudioAsVoice?: boolean;
  sendVideoAsGif?: boolean;
  sendMediaAsSticker?: boolean;
  sendMediaAsDocument?: boolean;
  sendMediaAsHd?: boolean;
  isViewOnce?: boolean;
  parseVCards?: boolean;
  caption?: string;
  quotedMessageId?: string;
  groupMentions?: any[];
  mentions?: string[];
  sendSeen?: boolean;
  invokedBotWid?: string;
  stickerAuthor?: string;
  stickerName?: string;
  stickerCategories?: string[];
  ignoreQuoteErrors?: boolean;
  waitUntilMsgSent?: boolean;
  media?: any;
}

/**
 * WhatsApp media information
 */
export interface WhatsAppMediaInfo {
  mimetype: string;
  filename?: string;
  data: Buffer;
}

/**
 * WhatsApp contact information
 */
export interface WhatsAppContact {
  id: string;
  name?: string;
  number: string;
  isBusiness?: boolean;
  isEnterprise?: boolean;
}

/**
 * WhatsApp group information
 */
export interface WhatsAppGroup {
  id: string;
  name: string;
  description?: string;
  participants: WhatsAppContact[];
  isGroup: boolean;
}

/**
 * Utility functions for WhatsApp operations
 */
export class WhatsAppUtils {
  /**
   * Normalize phone number to WhatsApp format (digits only)
   */
  static normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    return phoneNumber.replace(/\D/g, '');
  }

  /**
   * Validate WhatsApp phone number format
   */
  static isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic validation for international format
    const regex = /^\+[1-9]\d{1,14}$/;
    return regex.test(phoneNumber);
  }

  /**
   * Extract phone number from WhatsApp ID
   */
  static extractPhoneNumberFromWid(wid: string): string {
    // WhatsApp IDs are in format: 1234567890@c.us
    const match = wid.match(/^(\d+)@/);
    return match ? match[1] : wid;
  }

  /**
   * Convert WhatsApp ID to phone number
   */
  static widToPhoneNumber(wid: string): string {
    const phone = this.extractPhoneNumberFromWid(wid);
    return this.normalizePhoneNumber(phone);
  }

  /**
   * Convert phone number to WhatsApp ID
   */
  static phoneNumberToWid(phoneNumber: string): string {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    return `${normalized}@c.us`;
  }

  /**
   * Check if a message type is media
   */
  static isMediaMessage(messageType: WhatsAppMessageType): boolean {
    return [
      WhatsAppMessageType.IMAGE,
      WhatsAppMessageType.VIDEO,
      WhatsAppMessageType.AUDIO,
      WhatsAppMessageType.DOCUMENT,
      WhatsAppMessageType.STICKER
    ].includes(messageType);
  }

  /**
   * Check if a message type is interactive
   */
  static isInteractiveMessage(messageType: WhatsAppMessageType): boolean {
    return [
      WhatsAppMessageType.BUTTONS_RESPONSE,
      WhatsAppMessageType.LIST_RESPONSE,
      WhatsAppMessageType.TEMPLATE_BUTTON_REPLY
    ].includes(messageType);
  }

  /**
   * Get file extension from MIME type
   */
  static getFileExtension(mimetype: string): string {
    const extensions: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-excel': 'xls'
    };

    return extensions[mimetype] || 'bin';
  }

  /**
   * Generate a unique message ID
   */
  static generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}