import { MessageChannel } from '../messaging/types'

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
