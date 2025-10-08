import { BotId } from '../value-objects/bot-id.vo';
import { PhoneNumber } from '../value-objects/phone-number.vo';
import { MessageChannel } from './channel.entity';
import { BotSettingsData, AutoResponseData, WebhookData } from '../dtos/config.dto';



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

