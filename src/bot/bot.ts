import { Bot, BotSettings, FlowRef, MessageChannel } from './types'
import { validateBotId, validateBotName } from './validation'

export function createBot(props: {
  id: string
  name: string
  phone?: string
  settings: BotSettings
  flows?: FlowRef[]
}): Bot {
  validateBotId(props.id)
  validateBotName(props.name)

  return {
    id: props.id,
    name: props.name,
    phone: props.phone,
    settings: props.settings,
    flows: props.flows || [],
  }
}

export function registerChannel(bot: Bot, channel: MessageChannel): Bot {
  bot.channel = channel
  return bot
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
