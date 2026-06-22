import { ActionExecutionContext } from './action'

export function resolveVars(text: string, context: ActionExecutionContext): string {
  return text
    .replace(/\{\{\s*sender\s*\}\}/g, context.sender)
    .replace(/\{\{\s*message\s*\}\}/g, context.message)
    .replace(/\{\{\s*bot\.id\s*\}\}/g, context.botId)
    .replace(/\{\{\s*variables\.([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const value = context.variables[key]
      return value !== undefined ? String(value) : ''
    })
}
