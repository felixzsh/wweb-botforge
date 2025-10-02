import { Bot, BotSettingsData, AutoResponseData, WebhookData } from '../domain/entities/bot.entity';
import { BotId } from '../domain/value-objects/bot-id.vo';
import { PhoneNumber } from '../domain/value-objects/phone-number.vo';
import { IBotFactory } from '../domain/interfaces/bot-factory.interface';

export class BotFactory implements IBotFactory {
  createFromConfig(config: any): Bot {
    // Validate and create value objects
    const id = new BotId(config.id);
    const name = config.name;
    const phone = config.phone ? new PhoneNumber(config.phone) : undefined;

    // Create settings
    const settings: BotSettingsData = {
      simulateTyping: config.settings?.simulate_typing ?? config.settings?.simulateTyping ?? true,
      typingDelay: config.settings?.typing_delay ?? config.settings?.typingDelay ?? 1000,
      readReceipts: config.settings?.read_receipts ?? config.settings?.readReceipts ?? true,
      ignoreGroups: config.settings?.ignore_groups ?? config.settings?.ignoreGroups ?? true,
      adminNumbers: (config.settings?.admin_numbers ?? config.settings?.adminNumbers)?.map((num: string) => new PhoneNumber(num)) ?? [],
      logLevel: config.settings?.log_level ?? config.settings?.logLevel ?? 'info'
    };

    // Create auto responses
    const autoResponses: AutoResponseData[] = config.auto_responses?.map((ar: any) => ({
      pattern: ar.pattern,
      response: ar.response,
      caseInsensitive: ar.case_insensitive ?? ar.caseInsensitive ?? false,
      priority: ar.priority ?? 1,
      responseOptions: ar.response_options ? {
        linkPreview: ar.response_options.link_preview ?? ar.response_options.linkPreview,
        sendAudioAsVoice: ar.response_options.send_audio_as_voice ?? ar.response_options.sendAudioAsVoice,
        sendVideoAsGif: ar.response_options.send_video_as_gif ?? ar.response_options.sendVideoAsGif,
        sendMediaAsSticker: ar.response_options.send_media_as_sticker ?? ar.response_options.sendMediaAsSticker,
        sendMediaAsDocument: ar.response_options.send_media_as_document ?? ar.response_options.sendMediaAsDocument,
        sendMediaAsHd: ar.response_options.send_media_as_hd ?? ar.response_options.sendMediaAsHd,
        isViewOnce: ar.response_options.is_view_once ?? ar.response_options.isViewOnce,
        parseVCards: ar.response_options.parse_v_cards ?? ar.response_options.parseVCards,
        caption: ar.response_options.caption,
        quotedMessageId: ar.response_options.quoted_message_id ?? ar.response_options.quotedMessageId,
        groupMentions: ar.response_options.group_mentions ?? ar.response_options.groupMentions,
        mentions: ar.response_options.mentions,
        sendSeen: ar.response_options.send_seen ?? ar.response_options.sendSeen,
        invokedBotWid: ar.response_options.invoked_bot_wid ?? ar.response_options.invokedBotWid,
        stickerAuthor: ar.response_options.sticker_author ?? ar.response_options.stickerAuthor,
        stickerName: ar.response_options.sticker_name ?? ar.response_options.stickerName,
        stickerCategories: ar.response_options.sticker_categories ?? ar.response_options.stickerCategories,
        ignoreQuoteErrors: ar.response_options.ignore_quote_errors ?? ar.response_options.ignoreQuoteErrors,
        waitUntilMsgSent: ar.response_options.wait_until_msg_sent ?? ar.response_options.waitUntilMsgSent,
        media: ar.response_options.media
      } : ar.responseOptions
    })) ?? [];

    // Create webhooks
    const webhooks: WebhookData[] = config.webhooks?.map((wh: any) => ({
      name: wh.name,
      pattern: wh.pattern,
      url: wh.url,
      method: wh.method ?? 'POST',
      headers: wh.headers ?? {},
      timeout: wh.timeout ?? 5000,
      retry: wh.retry ?? 3,
      priority: wh.priority ?? 1
    })) ?? [];

    return new Bot(id, name, settings, phone, autoResponses, webhooks);
  }

  createBots(rawConfig: { bots: any[] }): Bot[] {
    return rawConfig.bots.map(config => this.createFromConfig(config));
  }
}

