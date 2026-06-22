export interface BotSettingsConfig {
  simulate_typing?: boolean
  typing_delay?: number
  queue_delay?: number
  read_receipts?: boolean
  ignore_groups?: boolean
  ignored_senders?: string[]
  admin_numbers?: string[]
}

export interface FlowRefConfig {
  id: string
  priority?: number
}

export interface BotConfig {
  flows?: FlowRefConfig[]
  settings?: BotSettingsConfig
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
  action: string
  branches?: FlowBranchConfig[]
}

export interface FlowConfig {
  entry_step: string
  triggers?: string | string[] | Array<{ phrases: string | string[]; fuzzy_threshold?: number }>
  timeout?: number
  fallback_step?: string
  steps: Record<string, FlowStepConfig>
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
  bots: Record<string, BotConfig>
}
