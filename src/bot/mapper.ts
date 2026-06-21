import { Bot, BotSettings, AutoResponse, Webhook, FlowRef, BotConfig, BotSettingsConfig, FlowRefConfig } from './types'
import { createBot, createDefaultSettings } from './bot'
import {
  validateBotId,
  validateBotName,
  validatePhoneNumber,
  validatePriority,
  validateResponse,
  validateWebhookUrl,
  validateWebhookName,
  validateTypingDelay,
  validateQueueDelay,
} from './validation'

export function mapConfigToBot(config: BotConfig): Bot {
  validateBotId(config.id)
  validateBotName(config.name)
  if (config.phone) {
    if (!validatePhoneNumber(config.phone)) {
      throw new Error('Invalid phone number format')
    }
  }

  const settings = config.settings ? mapSettings(config.settings) : createDefaultSettings()
  const flows = (config.flows || []).map(mapFlowRef)
  const autoResponses = (config.auto_responses || []).map(mapAutoResponse)
  const webhooks = (config.webhooks || []).map(mapWebhook)

  return createBot({
    id: config.id,
    name: config.name,
    phone: config.phone,
    settings,
    flows,
    autoResponses,
    webhooks,
  })
}

export function mapFlowRef(config: FlowRefConfig): FlowRef {
  if (config.priority !== undefined) {
    validatePriority(config.priority)
  }

  return {
    id: config.id,
    priority: config.priority ?? 1,
  }
}

export function mapSettings(config: BotSettingsConfig): BotSettings {
  if (config.typing_delay !== undefined) {
    validateTypingDelay(config.typing_delay)
  }
  if (config.queue_delay !== undefined) {
    validateQueueDelay(config.queue_delay)
  }

  return {
    simulateTyping: config.simulate_typing ?? true,
    typingDelay: config.typing_delay ?? 1000,
    queueDelay: config.queue_delay ?? 1000,
    readReceipts: config.read_receipts ?? true,
    ignoreGroups: config.ignore_groups ?? true,
    ignoredSenders: config.ignored_senders || [],
    adminNumbers: config.admin_numbers || [],
  }
}

export function mapAutoResponse(config: {
  pattern: string
  response: string
  case_insensitive?: boolean
  fuzzy_threshold?: number
  priority?: number
  cooldown?: number
  response_options?: Record<string, any>
}): AutoResponse {
  validateResponse(config.response)
  if (config.priority !== undefined) {
    validatePriority(config.priority)
  }

  const segments = config.pattern
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (segments.length === 0) {
    throw new Error('Auto-response pattern must contain at least one phrase')
  }

  return {
    fuzzySegments: segments,
    patternString: config.pattern,
    response: config.response,
    priority: config.priority ?? 1,
    cooldown: config.cooldown,
    fuzzyThreshold: config.fuzzy_threshold ?? 0.6,
    responseOptions: config.response_options,
  }
}

export function mapWebhook(config: {
  name: string
  pattern: string
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH'
  headers?: Record<string, string>
  timeout?: number
  retry?: number
  fuzzy_threshold?: number
  priority?: number
  cooldown?: number
}): Webhook {
  validateWebhookName(config.name)
  validateWebhookUrl(config.url)
  if (config.priority !== undefined) {
    validatePriority(config.priority)
  }

  const segments = config.pattern
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  if (segments.length === 0) {
    throw new Error('Webhook pattern must contain at least one phrase')
  }

  return {
    name: config.name,
    fuzzySegments: segments,
    patternString: config.pattern,
    url: config.url,
    method: config.method ?? 'POST',
    headers: config.headers ?? {},
    timeout: config.timeout ?? 5000,
    retries: config.retry ?? 3,
    priority: config.priority ?? 1,
    fuzzyThreshold: config.fuzzy_threshold ?? 0.6,
    cooldown: config.cooldown,
  }
}

export function mapBotsFromConfig(configs: BotConfig[]): Bot[] {
  return configs.map(mapConfigToBot)
}
