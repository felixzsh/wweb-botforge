export interface WebhookAction {
  name?: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  headers: Record<string, string>
  timeout: number
  retries: number
}

export interface ActionDef {
  id: string
  reply?: string
  webhook?: WebhookAction
  cooldown?: number
  cooldownReply?: string
}

export type ActionCatalog = Map<string, ActionDef>

export interface ActionExecutionContext {
  botId: string
  botName: string
  sender: string
  message: string
  variables: Record<string, any>
}

export interface ActionExecutionResult {
  reply?: string
  webhook?: WebhookAction
}
