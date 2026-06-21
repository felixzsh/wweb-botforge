import { ActionDef, ActionCatalog } from './types'
import { ActionConfig, WebhookActionConfig } from '../bot/types'

export function resolveAction(catalog: ActionCatalog, id: string): ActionDef {
  const action = catalog.get(id)
  if (!action) {
    throw new Error(`Action "${id}" not found in catalog`)
  }
  return action
}

export function mapActionCatalog(config: Record<string, ActionConfig>): ActionCatalog {
  const catalog: ActionCatalog = new Map()

  for (const [id, actionConfig] of Object.entries(config)) {
    catalog.set(id, mapAction(id, actionConfig))
  }

  return catalog
}

function mapAction(id: string, config: ActionConfig): ActionDef {
  if (!config.reply && !config.webhook) {
    throw new Error(`Action "${id}" must define reply, webhook, or both`)
  }

  return {
    id,
    reply: config.reply,
    webhook: config.webhook ? mapWebhookAction(config.webhook) : undefined,
    cooldown: config.cooldown,
    cooldownReply: config.cooldown_reply,
  }
}

function mapWebhookAction(config: WebhookActionConfig): {
  name?: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  headers: Record<string, string>
  timeout: number
  retries: number
} {
  return {
    name: config.name,
    url: config.url,
    method: config.method ?? 'POST',
    headers: config.headers ?? {},
    timeout: config.timeout ?? 5000,
    retries: config.retry ?? 3,
  }
}
