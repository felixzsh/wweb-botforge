import { ActionCatalog, ActionDef, ActionExecutionContext, ActionExecutionResult } from './types'
import { resolveAction } from './catalog'
import { resolveVars } from './template'

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
