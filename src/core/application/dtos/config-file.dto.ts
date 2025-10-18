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

