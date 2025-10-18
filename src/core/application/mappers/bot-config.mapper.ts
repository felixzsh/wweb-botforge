import { Bot } from '../../domain/entities/bot.entity';
import { BotSettings } from '../../domain/value-objects/bot-settings.vo';
import { AutoResponse } from '../../domain/value-objects/auto-response.vo';
import { Webhook } from '../../domain/value-objects/webhook.vo';
import { BotId } from '../../domain/value-objects/bot-id.vo';
import { PhoneNumber } from '../../domain/value-objects/phone-number.vo';
import { ResponsePattern } from '../../domain/value-objects/response-pattern.vo';
import { BotConfigDTO } from '../dtos/config-file.dto';

export class BotConfigMapper {
  static toDomain(dto: BotConfigDTO): Bot {
    // Mapear settings con defaults
    const settings = dto.settings
      ? BotSettings.create({
          simulateTyping: dto.settings.simulate_typing ?? true,
          typingDelay: dto.settings.typing_delay ?? 1000,
          queueDelay: dto.settings.queue_delay ?? 1000,
          readReceipts: dto.settings.read_receipts ?? true,
          ignoreGroups: dto.settings.ignore_groups ?? true,
          ignoredSenders: dto.settings.ignored_senders || [],
          adminNumbers: dto.settings.admin_numbers || []
        })
      : BotSettings.createDefault();

    // Mapear auto responses
    const autoResponses = (dto.auto_responses || []).map(ar =>
      AutoResponse.create({
        pattern: ResponsePattern.create(
          ar.pattern,
          ar.case_insensitive ?? false
        ),
        response: ar.response,
        priority: ar.priority ?? 1,
        cooldown: ar.cooldown,
        responseOptions: ar.response_options
      })
    );

    // Mapear webhooks
    const webhooks = (dto.webhooks || []).map(wh => 
      Webhook.create({
        name: wh.name,
        pattern: ResponsePattern.create(wh.pattern, true),
        url: wh.url,
        method: wh.method ?? 'POST',
        headers: wh.headers,
        timeout: wh.timeout ?? 5000,
        retries: wh.retry ?? 3,
        priority: wh.priority ?? 1,
        cooldown: wh.cooldown
      })
    );

    return Bot.create({
      id: new BotId(dto.id),
      name: dto.name,
      settings,
      phone: dto.phone ? new PhoneNumber(dto.phone) : undefined,
      autoResponses,
      webhooks
    });
  }

  static toDTO(bot: Bot): BotConfigDTO {
    // Implementar si necesitas escribir config de vuelta al YAML
    return {
      id: bot.id.value,
      name: bot.name,
      phone: bot.phone?.value,
      auto_responses: bot.autoResponses.map(ar => ({
        pattern: ar.pattern.getPattern(),
        response: ar.response,
        priority: ar.priority,
        cooldown: ar.cooldown
      })),
      webhooks: bot.webhooks.map(wh => ({
        name: wh.name,
        pattern: wh.pattern.getPattern(),
        url: wh.url,
        method: wh.method,
        timeout: wh.timeout,
        retry: wh.retries,
        priority: wh.priority,
        cooldown: wh.cooldown
      })),
      settings: {
        simulate_typing: bot.settings.simulateTyping,
        typing_delay: bot.settings.typingDelay,
        queue_delay: bot.settings.queueDelay,
        read_receipts: bot.settings.readReceipts,
        ignore_groups: bot.settings.ignoreGroups,
        ignored_senders: bot.settings.ignoredSenders,
        admin_numbers: bot.settings.adminNumbers
      }
    };
  }
}
