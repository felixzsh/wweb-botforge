import { BotId } from '../value-objects/bot-id.vo';
import { PhoneNumber } from '../value-objects/phone-number.vo';
import { IMessageChannel } from '../ports/imessage-channel';
import { BotSettings } from '../value-objects/bot-settings.vo';
import { AutoResponse } from '../value-objects/auto-response.vo';
import { Webhook } from '../value-objects/webhook.vo';

export interface BotProps {
  id: BotId;
  name: string;
  settings: BotSettings;
  phone?: PhoneNumber;
  autoResponses: AutoResponse[];
  webhooks: Webhook[];
}

export class Bot {
  public channel?: IMessageChannel;

  private constructor(private props: BotProps) {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Bot name cannot be empty');
    }
  }

  static create(props: BotProps): Bot {
    return new Bot(props);
  }

  /**
   * Register a message channel for this bot
   */
  registerChannel(channel: IMessageChannel): void {
    this.channel = channel;
  }

  // Business methods
  findMatchingAutoResponse(message: string): AutoResponse | null {
    // Sort by priority descending (highest first) and find first match
    return [...this.props.autoResponses]
      .sort((a, b) => b.priority - a.priority)
      .find(response => response.matches(message)) || null;
  }

  findMatchingWebhook(message: string): Webhook | null {
    // Sort by priority descending (highest first) and find first match
    return [...this.props.webhooks]
      .sort((a, b) => b.priority - a.priority)
      .find(webhook => webhook.matches(message)) || null;
  }

  findMatchingWebhooks(message: string): Webhook[] {
    // Sort by priority descending (highest first) and find all matches
    return [...this.props.webhooks]
      .sort((a, b) => b.priority - a.priority)
      .filter(webhook => webhook.matches(message));
  }

  // Getters
  get id(): BotId {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get settings(): BotSettings {
    return this.props.settings;
  }

  get phone(): PhoneNumber | undefined {
    return this.props.phone;
  }

  get autoResponses(): AutoResponse[] {
    return this.props.autoResponses;
  }

  get webhooks(): Webhook[] {
    return this.props.webhooks;
  }
}
