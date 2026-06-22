import { Bot, BotSettings, FlowRef } from './types'
import { MessageChannel } from '../messaging/types'
import { validateId } from '../utils/validation'

export function createBot(props: {
  id: string
  phone?: string
  settings: BotSettings
  flows?: FlowRef[]
}): Bot {
  validateId(props.id, 'Bot')

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
