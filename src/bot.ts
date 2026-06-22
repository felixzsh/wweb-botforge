import { MessageChannel } from './messages/contracts'
import { validateId } from './utils/validation'

export interface FlowRef {
  id: string
  priority: number
}

export interface Bot {
  id: string
  phone?: string
  settings: BotSettings
  flows: FlowRef[]
  channel?: MessageChannel
}

export interface BotSettings {
  simulateTyping: boolean
  typingDelay: number
  queueDelay: number
  readReceipts: boolean
  ignoreGroups: boolean
  ignoredSenders: string[]
  adminNumbers: string[]
}

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
