import { Bot, BotSettings, FlowRef, MessageChannel } from './types'
import { validateBotId } from './validation'

export function createBot(props: {
  id: string
  phone?: string
  settings: BotSettings
  flows?: FlowRef[]
}): Bot {
  validateBotId(props.id)

  return {
    id: props.id,
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
