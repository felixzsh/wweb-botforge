export function resolveVars(text: string, context: ActionExecutionContext): string {
  return text
    .replace(/\{\{\s*sender\s*\}\}/g, context.sender)
    .replace(/\{\{\s*senderName\s*\}\}/g, context.senderName ?? context.sender)
    .replace(/\{\{\s*message\s*\}\}/g, context.message)
    .replace(/\{\{\s*bot\.id\s*\}\}/g, context.botId)
    .replace(/\{\{\s*variables\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const value = context.variables[key]
      return value !== undefined ? String(value) : ''
    })
}

export interface WebhookAction {
  name?: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  headers: Record<string, string>
  timeout: number
  retries: number
}

export interface LocationAction {
  latitude: number
  longitude: number
  name?: string
  address?: string
  url?: string
  description?: string
}

export interface ActionDef {
  id: string
  reply?: string
  webhook?: WebhookAction
  location?: LocationAction
  cooldown?: number
  cooldownReply?: string
}

export type ActionCatalog = Map<string, ActionDef>

export interface ActionExecutionContext {
  botId: string
  botName: string
  sender: string
  senderName?: string
  message: string
  variables: Record<string, any>
}

export interface ActionExecutionResult {
  reply?: string
  webhook?: WebhookAction
  location?: LocationAction
}

export function resolveAction(catalog: ActionCatalog, id: string): ActionDef {
  const action = catalog.get(id)
  if (!action) {
    throw new Error(`Action "${id}" not found in catalog`)
  }
  return action
}

export function executeAction(
  catalog: ActionCatalog,
  actionId: string,
  context: ActionExecutionContext
): ActionExecutionResult {
  const action = resolveAction(catalog, actionId)
  const result: ActionExecutionResult = {}

  if (action.reply) {
    result.reply = resolveVars(action.reply, context)
  }

  if (action.webhook) {
    result.webhook = {
      ...action.webhook,
      url: resolveVars(action.webhook.url, context),
    }
  }

  if (action.location) {
    result.location = { ...action.location }
  }

  return result
}

export function getAction(catalog: ActionCatalog, actionId: string): ActionDef {
  return resolveAction(catalog, actionId)
}
