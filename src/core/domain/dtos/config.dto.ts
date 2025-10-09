import { PhoneNumber } from '../value-objects/phone-number.vo';

export interface BotConfiguration {
  id: string;
  name: string;
  phone?: string;
  auto_responses?: any[];
  webhooks?: any[];
  settings?: any;
}


export interface BotSettingsData {
  simulateTyping: boolean;
  typingDelay: number;
  readReceipts: boolean;
  ignoreGroups: boolean;
  ignoredSenders: string[];
  adminNumbers: PhoneNumber[];
  logLevel: 'info' | 'debug' | 'warn' | 'error';
}

export interface AutoResponseData {
  pattern: string;
  response: string;
  caseInsensitive: boolean;
  priority: number;
  responseOptions?: ResponseOptions;
  cooldown?: number;
}

// all send message options suported by whatsappweb-js
export interface ResponseOptions {
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

export interface WebhookData {
  name: string;
  pattern: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  timeout: number;
  retry: number;
  priority: number;
  cooldown?: number;
}
// Global configuration for the entire BotForge system
export interface GlobalConfig {
  chromiumPath?: string;
  logLevel?: 'info' | 'debug' | 'warn' | 'error';
  // Add more global settings as needed
}

// ConfigFile DTO that represents the whole config file
export interface ConfigFile {
  global?: GlobalConfig;
  bots: BotConfiguration[];
}



