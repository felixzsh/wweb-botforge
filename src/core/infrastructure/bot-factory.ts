import { Bot } from '../domain/entities/bot.entity';
import { BotId } from '../domain/value-objects/bot-id.vo';
import { PhoneNumber } from '../domain/value-objects/phone-number.vo';
import { BotSettings } from '../domain/entities/bot-settings.entity';
import { AutoResponse } from '../domain/entities/auto-response.entity';
import { Webhook } from '../domain/entities/webhook.entity';
import { IBotFactory } from '../domain/interfaces/bot-factory.interface';

export class BotFactory implements IBotFactory {
  createFromConfig(config: any): Bot {
    // Validate and create value objects
    const id = new BotId(config.id);
    const name = config.name;
    const phone = config.phone ? new PhoneNumber(config.phone) : undefined;

    // Create settings
    const settings = new BotSettings(
      config.settings?.simulate_typing ?? config.settings?.simulateTyping ?? true,
      config.settings?.typing_delay ?? config.settings?.typingDelay ?? 1000,
      config.settings?.read_receipts ?? config.settings?.readReceipts ?? true,
      config.settings?.ignore_groups ?? config.settings?.ignoreGroups ?? true,
      (config.settings?.admin_numbers ?? config.settings?.adminNumbers)?.map((num: string) => new PhoneNumber(num)) ?? [],
      config.settings?.log_level ?? config.settings?.logLevel ?? 'info'
    );

    // Create auto responses
    const autoResponses = config.auto_responses?.map((ar: any) =>
      new AutoResponse(ar.pattern, ar.response, ar.case_insensitive ?? ar.caseInsensitive, ar.priority)
    ) ?? [];

    // Create webhooks
    const webhooks = config.webhooks?.map((wh: any) =>
      new Webhook(wh.name, wh.pattern, wh.url, wh.method, wh.headers, wh.timeout, wh.retry, wh.priority)
    ) ?? [];

    return new Bot(id, name, settings, phone, autoResponses, webhooks);
  }

  createBots(rawConfig: { bots: any[] }): Bot[] {
    return rawConfig.bots.map(config => this.createFromConfig(config));
  }
}
