// Represents EXACTLY config file structure
export interface ConfigFileDTO {
  global?: {
    chromiumPath?: string;
    logLevel?: 'info' | 'debug' | 'warn' | 'error';
    apiPort?: number;
    apiEnabled?: boolean;
  };
  bots: BotConfigDTO[];
}

export interface BotConfigDTO {
  id: string;
  name: string;
  phone?: string;
  auto_responses?: AutoResponseDTO[];
  webhooks?: WebhookDTO[];
  settings?: BotSettingsDTO;
}

export interface BotSettingsDTO {
  simulate_typing?: boolean;
  typing_delay?: number;
  queue_delay?: number;
  read_receipts?: boolean;
  ignore_groups?: boolean;
  ignored_senders?: string[];
  admin_numbers?: string[];
}

export interface AutoResponseDTO {
  pattern: string;
  response: string;
  case_insensitive?: boolean;
  priority?: number;
  cooldown?: number;
  response_options?: ResponseOptionsDTO;
}

export interface ResponseOptionsDTO {
  linkPreview?: boolean;
  link_preview?: boolean;
  sendAudioAsVoice?: boolean;
  send_audio_as_voice?: boolean;
  sendVideoAsGif?: boolean;
  send_video_as_gif?: boolean;
  sendMediaAsSticker?: boolean;
  send_media_as_sticker?: boolean;
  sendMediaAsDocument?: boolean;
  send_media_as_document?: boolean;
  sendMediaAsHd?: boolean;
  send_media_as_hd?: boolean;
  isViewOnce?: boolean;
  is_view_once?: boolean;
  parseVCards?: boolean;
  parse_v_cards?: boolean;
  caption?: string;
  quotedMessageId?: string;
  quoted_message_id?: string;
  groupMentions?: any[];
  group_mentions?: any[];
  mentions?: string[];
  sendSeen?: boolean;
  send_seen?: boolean;
  invokedBotWid?: string;
  invoked_bot_wid?: string;
  stickerAuthor?: string;
  sticker_author?: string;
  stickerName?: string;
  sticker_name?: string;
  stickerCategories?: string[];
  sticker_categories?: string[];
  ignoreQuoteErrors?: boolean;
  ignore_quote_errors?: boolean;
  waitUntilMsgSent?: boolean;
  wait_until_msg_sent?: boolean;
  media?: string;
}

export interface WebhookDTO {
  name: string;
  pattern: string;
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;
  retry?: number;
  priority?: number;
  cooldown?: number;
}

export interface GlobalConfigDTO {
  chromiumPath?: string;
  logLevel?: 'info' | 'debug' | 'warn' | 'error';
  apiPort?: number;
  apiEnabled?: boolean;
}

