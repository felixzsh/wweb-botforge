import { resolveVars } from './template'

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

  return result
}

export function getAction(catalog: ActionCatalog, actionId: string): ActionDef {
  return resolveAction(catalog, actionId)
}
