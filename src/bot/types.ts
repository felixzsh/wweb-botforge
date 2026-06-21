export interface FlowRef {
  id: string
  priority: number
}

export interface Bot {
  id: string
  name: string
  phone?: string
  settings: BotSettings
  flows: FlowRef[]
  autoResponses: AutoResponse[]
  webhooks: Webhook[]
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

export interface AutoResponse {
  fuzzySegments: string[]
  patternString: string
  response: string
  priority: number
  cooldown?: number
  fuzzyThreshold: number
  responseOptions?: Record<string, any>
}

export interface Webhook {
  name: string
  fuzzySegments: string[]
  patternString: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  headers: Record<string, string>
  timeout: number
  retries: number
  priority: number
  fuzzyThreshold: number
  cooldown?: number
}

export interface IncomingMessage {
  id: string
  from: string
  to: string
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface OutgoingMessage {
  to: string
  content: string
  metadata?: Record<string, any>
}

export interface MessageChannel {
  send(message: OutgoingMessage): Promise<string>
  onMessage(handler: (message: IncomingMessage) => void | Promise<void>): void
  onReady(handler: () => void | Promise<void>): void
  onDisconnected(handler: (reason: string) => void | Promise<void>): void
  onAuthFailure(handler: (error: Error) => void | Promise<void>): void
  onConnectionError(handler: (error: Error) => void | Promise<void>): void
  onStateChange(handler: (newState: string) => void | Promise<void>): void
  connect(): Promise<void>
  disconnect(): Promise<void>
}

export interface BotConfig {
  id: string
  name: string
  phone?: string
  flows?: FlowRefConfig[]
  auto_responses?: AutoResponseConfig[]
  webhooks?: WebhookConfig[]
  settings?: BotSettingsConfig
}

export interface BotSettingsConfig {
  simulate_typing?: boolean
  typing_delay?: number
  queue_delay?: number
  read_receipts?: boolean
  ignore_groups?: boolean
  ignored_senders?: string[]
  admin_numbers?: string[]
}

export interface WebhookActionConfig {
  name?: string
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH'
  headers?: Record<string, string>
  timeout?: number
  retry?: number
}

export interface ActionConfig {
  reply?: string
  webhook?: WebhookActionConfig
  cooldown?: number
  cooldown_reply?: string
}

export interface FlowBranchConfig {
  when?: string | string[]
  fuzzy_threshold?: number
  goto: string
}

export interface FlowStepConfig {
  triggers?: string | string[] | Array<{ phrases: string | string[]; fuzzy_threshold?: number }>
  action: string
  branches?: FlowBranchConfig[]
}

export interface FlowConfig {
  name?: string
  entry: string
  timeout?: number
  fallback_step?: string
  steps: Record<string, FlowStepConfig>
}

export interface FlowRefConfig {
  id: string
  priority?: number
}

export interface AutoResponseConfig {
  pattern: string
  response: string
  case_insensitive?: boolean
  fuzzy_threshold?: number
  priority?: number
  cooldown?: number
  response_options?: Record<string, any>
}

export interface WebhookConfig {
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
}

export interface ConfigFile {
  global?: {
    chromiumPath?: string
    logLevel?: 'info' | 'debug' | 'warn' | 'error'
    apiPort?: number
    apiEnabled?: boolean
    sessionTimeout?: number
  }
  actions?: Record<string, ActionConfig>
  flows?: Record<string, FlowConfig>
  bots: BotConfig[]
}

export interface WebhookPayload {
  sender: string
  message: string
  timestamp: string
  botId: string
  botName: string
  webhookName: string
  webhookPattern: string
  metadata: Record<string, any>
}
