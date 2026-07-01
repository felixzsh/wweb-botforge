import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { ActionConfig, GraphConfig, BotConfig } from './schema'
import { getDefaultConfigPath } from './yaml'

export function validateId(id: string, kind: string): void {
  if (!id || id.length < 3) {
    throw new Error(`${kind} ID must be at least 3 characters long`)
  }
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`${kind} ID can only contain lowercase letters, numbers and hyphens`)
  }
  if (/^[-]/.test(id)) {
    throw new Error(`${kind} ID cannot start with a hyphen`)
  }
  if (/[-]$/.test(id)) {
    throw new Error(`${kind} ID cannot end with a hyphen`)
  }
  if (/--/.test(id)) {
    throw new Error(`${kind} ID cannot contain consecutive hyphens`)
  }
}

export function validateTypingDelay(delay: number): void {
  if (delay < 0) {
    throw new Error('Typing delay must be non-negative')
  }
}

export function validateQueueDelay(delay: number): void {
  if (delay < 0) {
    throw new Error('Queue delay must be non-negative')
  }
}

export interface ValidationError {
  file: string
  line: number | null
  message: string
}

export interface ValidationResult {
  errors: ValidationError[]
  valid: boolean
}

class FileContext {
  errors: ValidationError[] = []
  filepath: string
  content: string
  lines: string[]

  constructor(filepath: string, content: string) {
    this.filepath = filepath
    this.content = content
    this.lines = content.split('\n')
  }

  add(message: string, field?: string): void {
    const line = field ? this.findLine(field) : null
    this.errors.push({ file: this.filepath, line, message })
  }

  get validationErrors(): ValidationError[] {
    return this.errors
  }

  private findLine(field: string): number | null {
    for (let i = 0; i < this.lines.length; i++) {
      if (new RegExp(`^\\s*${escapeRegex(field)}:`).test(this.lines[i])) {
        return i + 1
      }
    }
    return null
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isValidLogLevel(value: unknown): value is string {
  return typeof value === 'string' && ['info', 'debug', 'warn', 'error'].includes(value)
}

function isValidHttpMethod(value: unknown): value is string {
  return typeof value === 'string' && ['GET', 'POST', 'PUT', 'PATCH'].includes(value.toUpperCase())
}

async function readAndParseYaml(filepath: string, ctx: FileContext): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filepath, 'utf-8')
    ctx.content = raw
    ctx.lines = raw.split('\n')
    const parsed = yaml.load(raw)
    if (parsed === null || parsed === undefined) {
      ctx.add('File is empty')
      return null
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      ctx.add('File must contain a YAML object, not an array or scalar', undefined)
      return null
    }
    return parsed
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    ctx.add(`YAML parse error: ${msg}`)
    return null
  }
}

function validateConfigFile(config: Record<string, unknown>, ctx: FileContext): void {
  if (config.chromiumPath !== undefined && typeof config.chromiumPath !== 'string') {
    ctx.add('chromiumPath must be a string', 'chromiumPath')
  }

  if (config.apiPort !== undefined) {
    if (typeof config.apiPort !== 'number' || !Number.isInteger(config.apiPort) || config.apiPort < 0) {
      ctx.add('apiPort must be a non-negative integer', 'apiPort')
    }
  }

  if (config.apiEnabled !== undefined && typeof config.apiEnabled !== 'boolean') {
    ctx.add('apiEnabled must be a boolean', 'apiEnabled')
  }

  if (config.logLevel !== undefined && !isValidLogLevel(config.logLevel)) {
    ctx.add('logLevel must be one of: info, debug, warn, error', 'logLevel')
  }

  if (config.sessionTimeout !== undefined) {
    if (typeof config.sessionTimeout !== 'number' || !Number.isInteger(config.sessionTimeout) || config.sessionTimeout < 0) {
      ctx.add('sessionTimeout must be a non-negative integer', 'sessionTimeout')
    }
  }
}

function validateActionFile(id: string, data: unknown, ctx: FileContext): ActionConfig | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    ctx.add('Action must be a YAML object')
    return null
  }

  const a = data as Record<string, unknown>
  const hasReply = a.reply !== undefined
  const hasWebhook = a.webhook !== undefined
  const hasLocation = a.location !== undefined

  if (!hasReply && !hasWebhook && !hasLocation) {
    ctx.add('Action must define reply, webhook, location, or a combination')
    return null
  }

  if (hasReply && typeof a.reply !== 'string') {
    ctx.add('action.reply must be a string', 'reply')
  }

  if (hasLocation) {
    if (typeof a.location !== 'object' || a.location === null || Array.isArray(a.location)) {
      ctx.add('action.location must be an object', 'location')
    } else {
      const loc = a.location as Record<string, unknown>
      if (typeof loc.latitude !== 'number' || !Number.isFinite(loc.latitude)) {
        ctx.add('action.location.latitude must be a number', 'latitude')
      } else if (loc.latitude < -90 || loc.latitude > 90) {
        ctx.add('action.location.latitude must be between -90 and 90', 'latitude')
      }
      if (typeof loc.longitude !== 'number' || !Number.isFinite(loc.longitude)) {
        ctx.add('action.location.longitude must be a number', 'longitude')
      } else if (loc.longitude < -180 || loc.longitude > 180) {
        ctx.add('action.location.longitude must be between -180 and 180', 'longitude')
      }
      if (loc.name !== undefined && typeof loc.name !== 'string') {
        ctx.add('action.location.name must be a string', 'name')
      }
      if (loc.address !== undefined && typeof loc.address !== 'string') {
        ctx.add('action.location.address must be a string', 'address')
      }
      if (loc.url !== undefined && typeof loc.url !== 'string') {
        ctx.add('action.location.url must be a string', 'url')
      }
      if (loc.description !== undefined && typeof loc.description !== 'string') {
        ctx.add('action.location.description must be a string', 'description')
      }
    }
  }

  if (hasWebhook) {
    if (typeof a.webhook !== 'object' || a.webhook === null || Array.isArray(a.webhook)) {
      ctx.add('action.webhook must be an object', 'webhook')
    } else {
      const wh = a.webhook as Record<string, unknown>
      if (typeof wh.url !== 'string') {
        ctx.add('action.webhook.url must be a string', 'url')
      }
      if (wh.method !== undefined && !isValidHttpMethod(wh.method)) {
        ctx.add('action.webhook.method must be GET, POST, PUT, or PATCH', 'method')
      }
      if (wh.timeout !== undefined && (typeof wh.timeout !== 'number' || wh.timeout < 0)) {
        ctx.add('action.webhook.timeout must be a non-negative number', 'timeout')
      }
      if (wh.retry !== undefined && (typeof wh.retry !== 'number' || wh.retry < 0 || !Number.isInteger(wh.retry))) {
        ctx.add('action.webhook.retry must be a non-negative integer', 'retry')
      }
      if (wh.headers !== undefined && (typeof wh.headers !== 'object' || wh.headers === null || Array.isArray(wh.headers))) {
        ctx.add('action.webhook.headers must be an object', 'headers')
      }
    }
  }

  if (a.cooldown !== undefined) {
    if (typeof a.cooldown !== 'number' || a.cooldown < 0) {
      ctx.add('action.cooldown must be a non-negative number', 'cooldown')
    }
  }

  if (a.cooldown_reply !== undefined && typeof a.cooldown_reply !== 'string') {
    ctx.add('action.cooldown_reply must be a string', 'cooldown_reply')
  }

  return hasReply || hasWebhook || hasLocation ? (data as ActionConfig) : null
}

function validateGraphFile(id: string, data: unknown, ctx: FileContext, allNodes: Set<string>): GraphConfig | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    ctx.add('Graph must be a YAML object')
    return null
  }

  const g = data as Record<string, unknown>

  if (typeof g.root !== 'string' || !g.root) {
    ctx.add('graph.root is required and must be a non-empty string', 'root')
    return null
  }

  if (!g.nodes || typeof g.nodes !== 'object' || Array.isArray(g.nodes)) {
    ctx.add('graph.nodes is required and must be an object', 'nodes')
    return null
  }

  const nodes = g.nodes as Record<string, unknown>
  const nodeKeys = Object.keys(nodes)

  if (nodeKeys.length === 0) {
    ctx.add('graph.nodes must have at least one node', 'nodes')
    return null
  }

  nodeKeys.forEach(nk => allNodes.add(nk))

  if (!nodes[g.root as string]) {
    ctx.add(`graph.root "${g.root}" not found in nodes`, 'root')
  }

  if (g.fallback_node !== undefined) {
    if (typeof g.fallback_node !== 'string') {
      ctx.add('graph.fallback_node must be a string', 'fallback_node')
    } else if (!nodes[g.fallback_node]) {
      ctx.add(`graph.fallback_node "${g.fallback_node}" not found in nodes`, 'fallback_node')
    }
  }

  if (g.timeout !== undefined) {
    if (typeof g.timeout !== 'number' || g.timeout < 0) {
      ctx.add('graph.timeout must be a non-negative number', 'timeout')
    }
  }

  if (g.triggers !== undefined) {
    ctx.add('graphs no longer support triggers; remove the triggers field; the bot auto-enters the graph root on first message', 'triggers')
  }

  for (const [nodeId, nodeData] of Object.entries(nodes)) {
    if (typeof nodeData !== 'object' || nodeData === null) {
      ctx.add(`graph.nodes.${nodeId} must be an object`, nodeId)
      continue
    }

    const node = nodeData as Record<string, unknown>

    if (typeof node.action !== 'string' || !node.action) {
      ctx.add(`graph.nodes.${nodeId}.action is required and must be a non-empty string`, nodeId)
    }

    if (node.edges !== undefined) {
      if (!Array.isArray(node.edges)) {
        ctx.add(`graph.nodes.${nodeId}.edges must be an array`, nodeId)
      } else {
        for (let ei = 0; ei < node.edges.length; ei++) {
          const edge = node.edges[ei]
          if (typeof edge !== 'object' || edge === null) {
            ctx.add(`graph.nodes.${nodeId}.edges[${ei}] must be an object`, nodeId)
            continue
          }
          const e = edge as Record<string, unknown>
          if (e.match !== undefined) {
            if (typeof e.match !== 'string' && !Array.isArray(e.match)) {
              ctx.add(`graph.nodes.${nodeId}.edges[${ei}].match must be a string or array`, nodeId)
            }
          }
          if (e.fuzzy_threshold !== undefined && (typeof e.fuzzy_threshold !== 'number' || e.fuzzy_threshold < 0 || e.fuzzy_threshold > 1)) {
            ctx.add(`graph.nodes.${nodeId}.edges[${ei}].fuzzy_threshold must be between 0 and 1`, nodeId)
          }
          if (typeof e.goto !== 'string' || !e.goto) {
            ctx.add(`graph.nodes.${nodeId}.edges[${ei}].goto is required and must be a non-empty string`, nodeId)
          }
        }
      }
    }
  }

  return data as GraphConfig
}

function findUnreachableNodes(graph: GraphConfig): string[] {
  const reachable = new Set<string>()
  const queue: string[] = [graph.root]
  reachable.add(graph.root)

  while (queue.length > 0) {
    const current = queue.shift()!
    const node = graph.nodes[current]
    if (!node || !node.edges) continue
    for (const edge of node.edges) {
      if (edge.goto && !reachable.has(edge.goto) && graph.nodes[edge.goto]) {
        reachable.add(edge.goto)
        queue.push(edge.goto)
      }
    }
  }

  return Object.keys(graph.nodes).filter(n => !reachable.has(n))
}

function validateBotFile(id: string, data: unknown, ctx: FileContext): BotConfig | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    ctx.add('Bot must be a YAML object')
    return null
  }

  const b = data as Record<string, unknown>

  if (b.graph !== undefined) {
    if (typeof b.graph !== 'string' || !b.graph) {
      ctx.add('bot.graph must be a non-empty string', 'graph')
    }
  }

  if (b.settings !== undefined) {
    if (typeof b.settings !== 'object' || b.settings === null || Array.isArray(b.settings)) {
      ctx.add('bot.settings must be an object', 'settings')
    } else {
      const s = b.settings as Record<string, unknown>
      if (s.simulate_typing !== undefined && typeof s.simulate_typing !== 'boolean') {
        ctx.add('bot.settings.simulate_typing must be a boolean', 'simulate_typing')
      }
      if (s.typing_delay !== undefined && (typeof s.typing_delay !== 'number' || s.typing_delay < 0)) {
        ctx.add('bot.settings.typing_delay must be a non-negative number', 'typing_delay')
      }
      if (s.queue_delay !== undefined && (typeof s.queue_delay !== 'number' || s.queue_delay < 0)) {
        ctx.add('bot.settings.queue_delay must be a non-negative number', 'queue_delay')
      }
      if (s.read_receipts !== undefined && typeof s.read_receipts !== 'boolean') {
        ctx.add('bot.settings.read_receipts must be a boolean', 'read_receipts')
      }
      if (s.ignore_groups !== undefined && typeof s.ignore_groups !== 'boolean') {
        ctx.add('bot.settings.ignore_groups must be a boolean', 'ignore_groups')
      }
      if (s.ignored_senders !== undefined) {
        if (!Array.isArray(s.ignored_senders)) {
          ctx.add('bot.settings.ignored_senders must be an array', 'ignored_senders')
        } else {
          for (let si = 0; si < s.ignored_senders.length; si++) {
            if (typeof s.ignored_senders[si] !== 'string') {
              ctx.add(`bot.settings.ignored_senders[${si}] must be a string`, 'ignored_senders')
            }
          }
        }
      }
      if (s.admin_numbers !== undefined) {
        if (!Array.isArray(s.admin_numbers)) {
          ctx.add('bot.settings.admin_numbers must be an array', 'admin_numbers')
        }
      }
    }
  }

  return data as BotConfig
}

function validateIdWithContext(id: string, kind: string, ctx: FileContext): void {
  try {
    validateId(id, kind)
  } catch (e) {
    ctx.add((e as Error).message)
  }
}

export async function validateConfig(configPath?: string): Promise<ValidationResult> {
  const targetPath = configPath || getDefaultConfigPath()
  const configDir = path.dirname(targetPath)
  const errors: ValidationError[] = []

  const actionsDir = path.join(configDir, 'actions')
  const graphsDir = path.join(configDir, 'graphs')
  const botsDir = path.join(configDir, 'bots')

  const allInlineActions: Map<string, ActionConfig> = new Map()
  const allDirActions: Map<string, ActionConfig> = new Map()
  const allInlineGraphs: Map<string, GraphConfig> = new Map()
  const allDirGraphs: Map<string, GraphConfig> = new Map()
  const allInlineBots: Map<string, BotConfig> = new Map()
  const allDirBots: Map<string, BotConfig> = new Map()

  if (!fsSync.existsSync(targetPath)) {
    errors.push({ file: targetPath, line: null, message: `Config file not found at ${targetPath}` })
    return { errors, valid: false }
  }

  const configRaw = await fs.readFile(targetPath, 'utf-8')
  const configCtx = new FileContext(targetPath, configRaw)
  let configParsed: Record<string, unknown> | null = null

  try {
    const parsed = yaml.load(configRaw)
    if (parsed === null || parsed === undefined) {
      configCtx.add('Config file is empty')
    } else if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      configCtx.add('Config must contain a YAML object at the root')
    } else {
      configParsed = parsed as Record<string, unknown>
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    configCtx.add(`YAML parse error: ${msg}`)
  }

  if (configParsed && typeof configParsed === 'object' && !Array.isArray(configParsed)) {
    const configObj = configParsed as Record<string, unknown>

    validateConfigFile(configObj, configCtx)

    if (configObj.bots !== undefined) {
      if (typeof configObj.bots !== 'object' || configObj.bots === null || Array.isArray(configObj.bots)) {
        configCtx.add('bots must be a YAML object (map of bot IDs to bot configs)', 'bots')
      } else {
        for (const [botId, botData] of Object.entries(configObj.bots as Record<string, unknown>)) {
          validateIdWithContext(botId, 'Bot', configCtx)
          const botCtx = new FileContext(targetPath, configRaw)
          const botConfig = validateBotFile(botId, botData, botCtx)
          if (botConfig) allInlineBots.set(botId, botConfig)
          botCtx.validationErrors.forEach(e => {
            e.message = `bots.${botId}: ${e.message}`
            errors.push(e)
          })
        }
      }
    }

    if (configObj.actions !== undefined) {
      if (typeof configObj.actions !== 'object' || configObj.actions === null || Array.isArray(configObj.actions)) {
        configCtx.add('actions must be a YAML object (map of action IDs to action configs)', 'actions')
      } else {
        for (const [actionId, actionData] of Object.entries(configObj.actions as Record<string, unknown>)) {
          validateIdWithContext(actionId, 'Action', configCtx)
          const actionCtx = new FileContext(targetPath, configRaw)
          const actionConfig = validateActionFile(actionId, actionData, actionCtx)
          if (actionConfig) allInlineActions.set(actionId, actionConfig)
          actionCtx.validationErrors.forEach(e => {
            e.message = `actions.${actionId}: ${e.message}`
            errors.push(e)
          })
        }
      }
    }

    if (configObj.graphs !== undefined) {
      if (typeof configObj.graphs !== 'object' || configObj.graphs === null || Array.isArray(configObj.graphs)) {
        configCtx.add('graphs must be a YAML object (map of graph IDs to graph configs)', 'graphs')
      } else {
        for (const [graphId, graphData] of Object.entries(configObj.graphs as Record<string, unknown>)) {
          validateIdWithContext(graphId, 'Graph', configCtx)
          const allNodes = new Set<string>()
          const graphCtx = new FileContext(targetPath, configRaw)
          const graphConfig = validateGraphFile(graphId, graphData, graphCtx, allNodes)
          if (graphConfig) {
            allInlineGraphs.set(graphId, graphConfig)
          }
          graphCtx.validationErrors.forEach(e => {
            e.message = `graphs.${graphId}: ${e.message}`
            errors.push(e)
          })

          if (graphConfig && allNodes.size > 0) {
            const edgeErrors = validateGraphEdgeTargets(graphId, graphConfig, allNodes, targetPath, configRaw)
            edgeErrors.forEach(e => errors.push(e))

            const unreachable = findUnreachableNodes(graphConfig)
            for (const nodeName of unreachable) {
              errors.push({
                file: targetPath,
                line: null,
                message: `graphs.${graphId}: warning: node "${nodeName}" is unreachable from root "${graphConfig.root}"`,
              })
            }
          }
        }
      }
    }
  }

  errors.push(...configCtx.validationErrors)

  if (fsSync.existsSync(actionsDir)) {
    const actionFiles = await loadDirFiles(actionsDir)
    for (const file of actionFiles) {
      const actionId = path.basename(file, path.extname(file))
      validateIdWithContext(actionId, 'Action', new FileContext(actionsDir, ''))
      const content = await fs.readFile(file, 'utf-8')
      const ctx = new FileContext(file, content)
      const parsed = await readAndParseYaml(file, ctx)
      if (parsed) {
        const actionConfig = validateActionFile(actionId, parsed, ctx)
        if (actionConfig) allDirActions.set(actionId, actionConfig)
      }
      errors.push(...ctx.validationErrors)
    }
  }

  if (fsSync.existsSync(graphsDir)) {
    const graphFiles = await loadDirFiles(graphsDir)
    for (const file of graphFiles) {
      const graphId = path.basename(file, path.extname(file))
      validateIdWithContext(graphId, 'Graph', new FileContext(graphsDir, ''))
      const content = await fs.readFile(file, 'utf-8')
      const ctx = new FileContext(file, content)
      const allNodes = new Set<string>()
      const parsed = await readAndParseYaml(file, ctx)
      if (parsed) {
        const graphConfig = validateGraphFile(graphId, parsed, ctx, allNodes)
        if (graphConfig) {
          allDirGraphs.set(graphId, graphConfig)
        }

        if (graphConfig && allNodes.size > 0) {
          const edgeErrors = validateGraphEdgeTargets(graphId, graphConfig, allNodes, file, content)
          edgeErrors.forEach(e => errors.push(e))

          const unreachable = findUnreachableNodes(graphConfig)
          for (const nodeName of unreachable) {
            errors.push({
              file: file,
              line: null,
              message: `graphs.${graphId}: warning: node "${nodeName}" is unreachable from root "${graphConfig.root}"`,
            })
          }
        }
      }
      errors.push(...ctx.validationErrors)
    }
  }

  if (fsSync.existsSync(botsDir)) {
    const botFiles = await loadDirFiles(botsDir)
    for (const file of botFiles) {
      const botId = path.basename(file, path.extname(file))
      validateIdWithContext(botId, 'Bot', new FileContext(botsDir, ''))
      const content = await fs.readFile(file, 'utf-8')
      const ctx = new FileContext(file, content)
      const parsed = await readAndParseYaml(file, ctx)
      if (parsed) {
        const botConfig = validateBotFile(botId, parsed, ctx)
        if (botConfig) allDirBots.set(botId, botConfig)
      }
      errors.push(...ctx.validationErrors)
    }
  }

  const mergedActions = new Map([...allDirActions, ...allInlineActions])
  const mergedGraphs = new Map([...allDirGraphs, ...allInlineGraphs])
  const mergedBots = new Map([...allDirBots, ...allInlineBots])

  if (mergedBots.size === 0) {
    errors.push({ file: targetPath, line: null, message: 'No bots defined. At least one bot is required.' })
  }

  for (const [graphId, graph] of mergedGraphs) {
    for (const [nodeId, node] of Object.entries(graph.nodes)) {
      if (node.action && !mergedActions.has(node.action)) {
        errors.push({
          file: targetPath,
          line: null,
          message: `Graph "${graphId}" node "${nodeId}" references action "${node.action}" which is not defined`,
        })
      }
    }
  }

  for (const [botId, bot] of mergedBots) {
    if (bot.graph && !mergedGraphs.has(bot.graph)) {
      errors.push({
        file: targetPath,
        line: null,
        message: `Bot "${botId}" references graph "${bot.graph}" which is not defined`,
      })
    }
  }

  if (mergedBots.size === 0 && fsSync.existsSync(botsDir)) {
    const botFiles = await fs.readdir(botsDir)
    const yamlBots = botFiles.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    if (yamlBots.length > 0) {
      errors.push({
        file: targetPath,
        line: null,
        message: 'Bot files found in bots/ but none were valid',
      })
    }
  }

  return {
    errors,
    valid: errors.length === 0
  }
}

function validateGraphEdgeTargets(
  graphId: string,
  graph: GraphConfig,
  allNodes: Set<string>,
  sourceFile: string,
  sourceContent: string
): ValidationError[] {
  const edgeErrors: ValidationError[] = []

  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    if (node.edges) {
      for (let ei = 0; ei < node.edges.length; ei++) {
        const edge = node.edges[ei]
        if (edge.goto && !allNodes.has(edge.goto)) {
          edgeErrors.push({
            file: sourceFile,
            line: null,
            message: `Graph "${graphId}" node "${nodeId}" edges[${ei}] goto "${edge.goto}" not found in nodes`,
          })
        }
      }
    }
  }

  return edgeErrors
}

async function loadDirFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir)
  return entries
    .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map(f => path.join(dir, f))
}
