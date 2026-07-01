export interface BotSettingsConfig {
  simulate_typing?: boolean
  typing_delay?: number
  queue_delay?: number
  read_receipts?: boolean
  ignore_groups?: boolean
  ignored_senders?: string[]
  admin_numbers?: string[]
}

export interface BotConfig {
  graph?: string
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

export interface LocationActionConfig {
  latitude: number
  longitude: number
  name?: string
  address?: string
  url?: string
  description?: string
}

export interface ActionConfig {
  reply?: string
  webhook?: WebhookActionConfig
  location?: LocationActionConfig
  cooldown?: number
  cooldown_reply?: string
}

export interface EdgeConfig {
  match?: string | string[]
  fuzzy_threshold?: number
  goto: string
}

export interface NodeConfig {
  action: string
  edges?: EdgeConfig[]
}

export interface GraphConfig {
  root: string
  timeout?: number
  fallback_node?: string
  nodes: Record<string, NodeConfig>
}

export interface ConfigFile {
  chromiumPath?: string
  logLevel?: 'info' | 'debug' | 'warn' | 'error'
  apiPort?: number
  apiEnabled?: boolean
  sessionTimeout?: number
  actions?: Record<string, ActionConfig>
  graphs?: Record<string, GraphConfig>
  bots: Record<string, BotConfig>
}
