import { Bot, BotSettings, AutoResponse, Webhook, MessageChannel, BehaviorRef } from './types'
import { validateBotId, validateBotName } from './validation'
import { matchFuzzy } from './fuzzy'

export function createBot(props: {
  id: string
  name: string
  phone?: string
  settings: BotSettings
  behaviors?: BehaviorRef[]
  autoResponses: AutoResponse[]
  webhooks: Webhook[]
}): Bot {
  validateBotId(props.id)
  validateBotName(props.name)

  return {
    id: props.id,
    name: props.name,
    phone: props.phone,
    settings: props.settings,
    behaviors: props.behaviors || [],
    autoResponses: props.autoResponses,
    webhooks: props.webhooks,
  }
}

export function registerChannel(bot: Bot, channel: MessageChannel): Bot {
  bot.channel = channel
  return bot
}

export function findMatchingAutoResponse(bot: Bot, message: string): AutoResponse | null {
  const sorted = [...bot.autoResponses].sort((a, b) => b.priority - a.priority)
  return sorted.find(response => matchFuzzy(response.fuzzySegments, message, response.fuzzyThreshold)) || null
}

export function findMatchingWebhook(bot: Bot, message: string): Webhook | null {
  const sorted = [...bot.webhooks].sort((a, b) => b.priority - a.priority)
  return sorted.find(webhook => matchFuzzy(webhook.fuzzySegments, message, webhook.fuzzyThreshold)) || null
}

export function findMatchingWebhooks(bot: Bot, message: string): Webhook[] {
  const sorted = [...bot.webhooks].sort((a, b) => b.priority - a.priority)
  return sorted.filter(webhook => matchFuzzy(webhook.fuzzySegments, message, webhook.fuzzyThreshold))
}

export function createDefaultSettings(): BotSettings {
  return {
    simulateTyping: true,
    typingDelay: 1000,
    queueDelay: 1000,
    readReceipts: true,
    ignoreGroups: true,
    ignoredSenders: [],
    adminNumbers: [],
  }
}
