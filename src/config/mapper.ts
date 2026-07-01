import { Bot, BotSettings, createBot, createDefaultSettings } from '../bot'
import { validateId, validateTypingDelay, validateQueueDelay } from './validation'
import { BotConfig, BotSettingsConfig, ActionConfig, WebhookActionConfig, LocationActionConfig, GraphConfig, NodeConfig, EdgeConfig } from './schema'
import { ActionDef, ActionCatalog, LocationAction } from '../actions/action'
import { GraphCatalog, GraphDef, Node, Edge } from '../graph/graph'

export function mapActionCatalog(config: Record<string, ActionConfig>): ActionCatalog {
  const catalog: ActionCatalog = new Map()

  for (const [id, actionConfig] of Object.entries(config)) {
    catalog.set(id, mapAction(id, actionConfig))
  }

  return catalog
}

function mapAction(id: string, config: ActionConfig): ActionDef {
  if (!config.reply && !config.webhook && !config.location) {
    throw new Error(`Action "${id}" must define reply, webhook, location, or a combination`)
  }

  return {
    id,
    reply: config.reply,
    webhook: config.webhook ? mapWebhookAction(config.webhook) : undefined,
    location: config.location ? mapLocationAction(config.location) : undefined,
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

function mapLocationAction(config: LocationActionConfig): LocationAction {
  return {
    latitude: config.latitude,
    longitude: config.longitude,
    name: config.name,
    address: config.address,
    url: config.url,
    description: config.description,
  }
}

export function mapGraphCatalog(config: Record<string, GraphConfig>): GraphCatalog {
  const catalog: GraphCatalog = new Map()

  for (const [id, graphConfig] of Object.entries(config)) {
    catalog.set(id, mapGraph(id, graphConfig))
  }

  return catalog
}

function mapGraph(id: string, config: GraphConfig): GraphDef {
  if (!config.nodes[config.root]) {
    throw new Error(`Graph "${id}" root node "${config.root}" not found`)
  }

  const nodes: Record<string, Node> = {}
  for (const [nodeId, nodeConfig] of Object.entries(config.nodes)) {
    nodes[nodeId] = mapNode(nodeConfig)
  }

  if (config.fallback_node && !nodes[config.fallback_node]) {
    throw new Error(`Graph "${id}" fallback node "${config.fallback_node}" not found`)
  }

  return {
    id,
    root: config.root,
    timeout: config.timeout,
    fallbackNode: config.fallback_node,
    nodes,
  }
}

function mapNode(config: NodeConfig): Node {
  return {
    action: config.action,
    edges: (config.edges || []).map(mapEdge),
  }
}

function mapEdge(config: EdgeConfig): Edge {
  return {
    match: config.match ? mapMatch(config.match) : undefined,
    fuzzyThreshold: config.fuzzy_threshold,
    goto: config.goto,
  }
}

function mapMatch(match: string | string[]): string[] {
  if (typeof match === 'string') {
    return splitPhrases(match)
  }
  return match.flatMap(splitPhrases)
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
  const graph = config.graph ?? ''

  return createBot({
    id,
    settings,
    graph,
  })
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
