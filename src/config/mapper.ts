import { Bot, BotSettings, FlowRef, createBot, createDefaultSettings } from '../bot/bot'
import { validateId, validatePriority, validateTypingDelay, validateQueueDelay } from '../utils/validation'
import { BotConfig, BotSettingsConfig, FlowRefConfig, ActionConfig, WebhookActionConfig, FlowConfig, FlowStepConfig, FlowBranchConfig } from './schema'
import { ActionDef, ActionCatalog } from '../action/action'
import { FlowCatalog, FlowDef, FlowStep, FlowBranch, FuzzyTrigger } from '../flow/flow'

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

export function mapFlowCatalog(config: Record<string, FlowConfig>): FlowCatalog {
  const catalog: FlowCatalog = new Map()

  for (const [id, flowConfig] of Object.entries(config)) {
    catalog.set(id, mapFlow(id, flowConfig))
  }

  return catalog
}

function mapFlow(id: string, config: FlowConfig): FlowDef {
  if (!config.steps[config.entry_step]) {
    throw new Error(`Flow "${id}" entry step "${config.entry_step}" not found`)
  }

  const steps: Record<string, FlowStep> = {}
  for (const [stepId, stepConfig] of Object.entries(config.steps)) {
    steps[stepId] = mapStep(stepConfig)
  }

  if (config.fallback_step && !steps[config.fallback_step]) {
    throw new Error(`Flow "${id}" fallback step "${config.fallback_step}" not found`)
  }

  return {
    id,
    entryStep: config.entry_step,
    triggers: config.triggers ? mapTriggers(config.triggers) : undefined,
    timeout: config.timeout,
    fallbackStep: config.fallback_step,
    steps,
  }
}

function mapStep(config: FlowStepConfig): FlowStep {
  return {
    action: config.action,
    branches: (config.branches || []).map(mapBranch),
  }
}

function mapTriggers(
  triggers: string | string[] | Array<{ phrases: string | string[]; fuzzy_threshold?: number }>
): FuzzyTrigger[] {
  if (typeof triggers === 'string') {
    return [{ phrases: splitPhrases(triggers) }]
  }

  if (triggers.length === 0) {
    return []
  }

  if (typeof triggers[0] === 'string') {
    return (triggers as string[]).map(text => ({ phrases: splitPhrases(text) }))
  }

  return (triggers as Array<{ phrases: string | string[]; fuzzy_threshold?: number }>).map(item => ({
    phrases: typeof item.phrases === 'string'
      ? splitPhrases(item.phrases)
      : (item.phrases as string[]).flatMap(splitPhrases),
    fuzzyThreshold: item.fuzzy_threshold,
  }))
}

function mapBranch(config: FlowBranchConfig): FlowBranch {
  return {
    when: config.when ? mapWhen(config.when) : undefined,
    fuzzyThreshold: config.fuzzy_threshold,
    goto: config.goto,
  }
}

function mapWhen(when: string | string[]): string[] {
  if (typeof when === 'string') {
    return splitPhrases(when)
  }
  return when.flatMap(splitPhrases)
}

function splitPhrases(value: string): string[] {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

export function mapBotsFromConfig(configs: Record<string, BotConfig>): Bot[] {
  return Object.entries(configs).map(([id, config]) => mapConfigToBot(id, config))
}

export function mapConfigToBot(id: string, config: BotConfig): Bot {
  validateId(id, 'Bot')

  const settings = config.settings ? mapSettings(config.settings) : createDefaultSettings()
  const flows = (config.flows || []).map(mapFlowRef)

  return createBot({
    id,
    settings,
    flows,
  })
}

export function mapFlowRef(config: FlowRefConfig): FlowRef {
  if (config.priority !== undefined) {
    validatePriority(config.priority)
  }

  return {
    id: config.id,
    priority: config.priority ?? 1,
  }
}

export function mapSettings(config: BotSettingsConfig): BotSettings {
  if (config.typing_delay !== undefined) {
    validateTypingDelay(config.typing_delay)
  }
  if (config.queue_delay !== undefined) {
    validateQueueDelay(config.queue_delay)
  }

  return {
    simulateTyping: config.simulate_typing ?? true,
    typingDelay: config.typing_delay ?? 1000,
    queueDelay: config.queue_delay ?? 1000,
    readReceipts: config.read_receipts ?? true,
    ignoreGroups: config.ignore_groups ?? true,
    ignoredSenders: config.ignored_senders || [],
    adminNumbers: config.admin_numbers || [],
  }
}
