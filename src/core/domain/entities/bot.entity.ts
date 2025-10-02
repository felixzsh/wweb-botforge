import { BotId } from '../value-objects/bot-id.vo';
import { PhoneNumber } from '../value-objects/phone-number.vo';
import { BotSettings } from './bot-settings.entity';
import { AutoResponse } from './auto-response.entity';
import { Webhook } from './webhook.entity';

export class Bot {
  constructor(
    public readonly id: BotId,
    public name: string,
    public settings: BotSettings,
    public phone?: PhoneNumber,
    public autoResponses: AutoResponse[] = [],
    public webhooks: Webhook[] = []
  ) {}

  // Business methods
  findMatchingAutoResponse(message: string): AutoResponse | null {
    // Sort by priority descending (highest first) and find first match
    return [...this.autoResponses]
      .sort((a, b) => b.priority - a.priority)
      .find(response => response.matches(message)) || null;
  }

  findMatchingWebhook(message: string): Webhook | null {
    // Sort by priority descending (highest first) and find first match
    return [...this.webhooks]
      .sort((a, b) => b.priority - a.priority)
      .find(webhook => webhook.matches(message)) || null;
  }
}
