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

export interface RequestStep {
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

export interface MessageStep {
  body: string
  to?: string
}

export type ActionStep =
  | { message: MessageStep }
  | { request: RequestStep }
  | { location: LocationAction }

export interface CooldownGuard {
  duration: number
  onBlocked?: ActionStep[]
}

export interface ActionDef {
  id: string
  guards?: {
    cooldown?: CooldownGuard
  }
  steps: ActionStep[]
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

export function resolveAction(catalog: ActionCatalog, id: string): ActionDef {
  const action = catalog.get(id)
  if (!action) {
    throw new Error(`Action "${id}" not found in catalog`)
  }
  return action
}

export function getAction(catalog: ActionCatalog, actionId: string): ActionDef {
  return resolveAction(catalog, actionId)
}
