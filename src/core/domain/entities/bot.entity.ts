import { BotId } from '../value-objects/bot-id.vo';
import { PhoneNumber } from '../value-objects/phone-number.vo';
import { MessageChannel } from './channel.entity';

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
}

export class Bot {
  public channel?: MessageChannel;

  constructor(
    public readonly id: BotId,
    public name: string,
    public settings: BotSettingsData,
    public phone?: PhoneNumber,
    public autoResponses: AutoResponseData[] = [],
    public webhooks: WebhookData[] = []
  ) {}

  /**
   * Register a message channel for this bot
   */
  registerChannel(channel: MessageChannel): void {
    this.channel = channel;
  }

  // Business methods
  findMatchingAutoResponse(message: string): AutoResponseData | null {
    // Sort by priority descending (highest first) and find first match
    return [...this.autoResponses]
      .sort((a, b) => b.priority - a.priority)
      .find(response => {
        const flags = response.caseInsensitive ? 'i' : '';
        const regex = new RegExp(response.pattern, flags);
        return regex.test(message);
      }) || null;
  }

  findMatchingWebhook(message: string): WebhookData | null {
    // Sort by priority descending (highest first) and find first match
    return [...this.webhooks]
      .sort((a, b) => b.priority - a.priority)
      .find(webhook => {
        const regex = new RegExp(webhook.pattern, 'i');
        return regex.test(message);
      }) || null;
  }
}

