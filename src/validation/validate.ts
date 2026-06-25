import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'
import { ActionConfig, FlowConfig, BotConfig } from '../config/schema'
import { getDefaultConfigPath } from '../config/yaml'
import { validateId, validatePriority, validateTypingDelay, validateQueueDelay } from '../helpers/validation'

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

async function loadYamlFile(filepath: string): Promise<{ content: string; parsed: unknown } | null> {
  try {
    const raw = await fs.readFile(filepath, 'utf-8')
    const parsed = yaml.load(raw)
    if (parsed === null || parsed === undefined) return null
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return { content: raw, parsed }
  } catch {
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

  if (!hasReply && !hasWebhook) {
    ctx.add('Action must define reply, webhook, or both')
    return null
  }

  if (hasReply && typeof a.reply !== 'string') {
    ctx.add('action.reply must be a string', 'reply')
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

  return hasReply || hasWebhook ? (data as ActionConfig) : null
}

function validateFlowFile(id: string, data: unknown, ctx: FileContext, allSteps: Set<string>): FlowConfig | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    ctx.add('Flow must be a YAML object')
    return null
  }

  const f = data as Record<string, unknown>

  if (typeof f.entry_step !== 'string' || !f.entry_step) {
    ctx.add('flow.entry_step is required and must be a non-empty string', 'entry_step')
    return null
  }

  if (!f.steps || typeof f.steps !== 'object' || Array.isArray(f.steps)) {
    ctx.add('flow.steps is required and must be an object', 'steps')
    return null
  }

  const steps = f.steps as Record<string, unknown>
  const stepKeys = Object.keys(steps)

  if (stepKeys.length === 0) {
    ctx.add('flow.steps must have at least one step', 'steps')
    return null
  }

  stepKeys.forEach(sk => allSteps.add(sk))

  if (!steps[f.entry_step as string]) {
    ctx.add(`flow.entry_step "${f.entry_step}" not found in steps`, 'entry_step')
  }

  if (f.fallback_step !== undefined) {
    if (typeof f.fallback_step !== 'string') {
      ctx.add('flow.fallback_step must be a string', 'fallback_step')
    } else if (!steps[f.fallback_step]) {
      ctx.add(`flow.fallback_step "${f.fallback_step}" not found in steps`, 'fallback_step')
    }
  }

  if (f.timeout !== undefined) {
    if (typeof f.timeout !== 'number' || f.timeout < 0) {
      ctx.add('flow.timeout must be a non-negative number', 'timeout')
    }
  }

  if (f.triggers !== undefined) {
    validateTriggers(f.triggers, ctx)
  }

  for (const [stepId, stepData] of Object.entries(steps)) {
    if (typeof stepData !== 'object' || stepData === null) {
      ctx.add(`flow.steps.${stepId} must be an object`, stepId)
      continue
    }

    const step = stepData as Record<string, unknown>

    if (typeof step.action !== 'string' || !step.action) {
      ctx.add(`flow.steps.${stepId}.action is required and must be a non-empty string`, stepId)
    }

    if (step.branches !== undefined) {
      if (!Array.isArray(step.branches)) {
        ctx.add(`flow.steps.${stepId}.branches must be an array`, stepId)
      } else {
        for (let bi = 0; bi < step.branches.length; bi++) {
          const branch = step.branches[bi]
          if (typeof branch !== 'object' || branch === null) {
            ctx.add(`flow.steps.${stepId}.branches[${bi}] must be an object`, stepId)
            continue
          }
          const br = branch as Record<string, unknown>
          if (br.when !== undefined) {
            if (typeof br.when !== 'string' && !Array.isArray(br.when)) {
              ctx.add(`flow.steps.${stepId}.branches[${bi}].when must be a string or array`, stepId)
            }
          }
          if (br.fuzzy_threshold !== undefined && (typeof br.fuzzy_threshold !== 'number' || br.fuzzy_threshold < 0 || br.fuzzy_threshold > 1)) {
            ctx.add(`flow.steps.${stepId}.branches[${bi}].fuzzy_threshold must be between 0 and 1`, stepId)
          }
          if (typeof br.goto !== 'string' || !br.goto) {
            ctx.add(`flow.steps.${stepId}.branches[${bi}].goto is required and must be a non-empty string`, stepId)
          }
        }
      }
    }
  }

  return data as FlowConfig
}

function validateTriggers(triggers: unknown, ctx: FileContext): void {
  if (typeof triggers === 'string') return

  if (Array.isArray(triggers)) {
    for (let i = 0; i < triggers.length; i++) {
      const t = triggers[i]
      if (typeof t === 'string') continue
      if (typeof t === 'object' && t !== null) {
        const obj = t as Record<string, unknown>
        if (obj.phrases === undefined) {
          ctx.add(`flow.triggers[${i}] object must have a 'phrases' field`)
        }
        if (obj.fuzzy_threshold !== undefined && (typeof obj.fuzzy_threshold !== 'number' || obj.fuzzy_threshold < 0 || obj.fuzzy_threshold > 1)) {
          ctx.add(`flow.triggers[${i}].fuzzy_threshold must be between 0 and 1`)
        }
      }
    }
    return
  }

  ctx.add('flow.triggers must be a string or array')
}

function validateBotFile(id: string, data: unknown, ctx: FileContext): BotConfig | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    ctx.add('Bot must be a YAML object')
    return null
  }

  const b = data as Record<string, unknown>

  if (b.flows !== undefined) {
    if (!Array.isArray(b.flows)) {
      ctx.add('bot.flows must be an array', 'flows')
    } else {
      for (let fi = 0; fi < b.flows.length; fi++) {
        const ref = b.flows[fi]
        if (typeof ref !== 'object' || ref === null) {
          ctx.add(`bot.flows[${fi}] must be an object`, 'flows')
          continue
        }
        const flowRef = ref as Record<string, unknown>
        if (typeof flowRef.id !== 'string' || !flowRef.id) {
          ctx.add(`bot.flows[${fi}].id is required and must be a non-empty string`, 'flows')
        }
        if (flowRef.priority !== undefined) {
          if (typeof flowRef.priority !== 'number' || flowRef.priority < 0) {
            ctx.add(`bot.flows[${fi}].priority must be a non-negative number`, 'flows')
          }
        }
      }
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
  const flowsDir = path.join(configDir, 'flows')
  const botsDir = path.join(configDir, 'bots')

  const allInlineActions: Map<string, ActionConfig> = new Map()
  const allDirActions: Map<string, ActionConfig> = new Map()
  const allInlineFlows: Map<string, FlowConfig> = new Map()
  const allDirFlows: Map<string, FlowConfig> = new Map()
  const allInlineBots: Map<string, BotConfig> = new Map()
  const allDirBots: Map<string, BotConfig> = new Map()

  // Validate config.yml
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

    if (configObj.flows !== undefined) {
      if (typeof configObj.flows !== 'object' || configObj.flows === null || Array.isArray(configObj.flows)) {
        configCtx.add('flows must be a YAML object (map of flow IDs to flow configs)', 'flows')
      } else {
        for (const [flowId, flowData] of Object.entries(configObj.flows as Record<string, unknown>)) {
          validateIdWithContext(flowId, 'Flow', configCtx)
          const allSteps = new Set<string>()
          const flowCtx = new FileContext(targetPath, configRaw)
          const flowConfig = validateFlowFile(flowId, flowData, flowCtx, allSteps)
          if (flowConfig) {
            allInlineFlows.set(flowId, flowConfig)
          }
          flowCtx.validationErrors.forEach(e => {
            e.message = `flows.${flowId}: ${e.message}`
            errors.push(e)
          })

          // Validate branch goto targets after we know all steps
          if (flowConfig && allSteps.size > 0) {
            const branchErrors = validateFlowBranchTargets(flowId, flowConfig, allSteps, targetPath, configRaw)
            branchErrors.forEach(e => errors.push(e))
          }
        }
      }
    }
  }

  errors.push(...configCtx.validationErrors)

  // Validate actions/ directory
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

  // Validate flows/ directory
  if (fsSync.existsSync(flowsDir)) {
    const flowFiles = await loadDirFiles(flowsDir)
    for (const file of flowFiles) {
      const flowId = path.basename(file, path.extname(file))
      validateIdWithContext(flowId, 'Flow', new FileContext(flowsDir, ''))
      const content = await fs.readFile(file, 'utf-8')
      const ctx = new FileContext(file, content)
      const allSteps = new Set<string>()
      const parsed = await readAndParseYaml(file, ctx)
      if (parsed) {
        const flowConfig = validateFlowFile(flowId, parsed, ctx, allSteps)
        if (flowConfig) {
          allDirFlows.set(flowId, flowConfig)
        }

        if (flowConfig && allSteps.size > 0) {
          const branchErrors = validateFlowBranchTargets(flowId, flowConfig, allSteps, file, content)
          branchErrors.forEach(e => errors.push(e))
        }
      }
      errors.push(...ctx.validationErrors)
    }
  }

  // Validate bots/ directory
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

  // Merge: inline takes precedence over dir
  const mergedActions = new Map([...allDirActions, ...allInlineActions])
  const mergedFlows = new Map([...allDirFlows, ...allInlineFlows])
  const mergedBots = new Map([...allDirBots, ...allInlineBots])

  // Cross-reference validation
  if (mergedBots.size === 0) {
    errors.push({ file: targetPath, line: null, message: 'No bots defined. At least one bot is required.' })
  }

  for (const [flowId, flow] of mergedFlows) {
    for (const [stepId, step] of Object.entries(flow.steps)) {
      if (step.action && !mergedActions.has(step.action)) {
        errors.push({
          file: targetPath,
          line: null,
          message: `Flow "${flowId}" step "${stepId}" references action "${step.action}" which is not defined`
        })
      }
    }
  }

  for (const [botId, bot] of mergedBots) {
    if (bot.flows) {
      for (const ref of bot.flows) {
        if (ref.id && !mergedFlows.has(ref.id)) {
          errors.push({
            file: targetPath,
            line: null,
            message: `Bot "${botId}" references flow "${ref.id}" which is not defined`
          })
        }
      }
    }
  }

  // If bots config is empty, the file-level bots check would catch it,
  // but if nothing was loaded from anywhere, we report
  if (mergedBots.size === 0 && fsSync.existsSync(botsDir)) {
    const botFiles = await fs.readdir(botsDir)
    const yamlBots = botFiles.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    if (yamlBots.length > 0) {
      errors.push({
        file: targetPath,
        line: null,
        message: 'Bot files found in bots/ but none were valid'
      })
    }
  }

  return {
    errors,
    valid: errors.length === 0
  }
}

function validateFlowBranchTargets(
  flowId: string,
  flow: FlowConfig,
  allSteps: Set<string>,
  sourceFile: string,
  sourceContent: string
): ValidationError[] {
  const branchErrors: ValidationError[] = []

  for (const [stepId, step] of Object.entries(flow.steps)) {
    if (step.branches) {
      for (let bi = 0; bi < step.branches.length; bi++) {
        const branch = step.branches[bi]
        if (branch.goto && !allSteps.has(branch.goto)) {
          branchErrors.push({
            file: sourceFile,
            line: null,
            message: `Flow "${flowId}" step "${stepId}" branch[${bi}] goto "${branch.goto}" not found in steps`
          })
        }
      }
    }
  }

  return branchErrors
}

async function loadDirFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir)
  return entries
    .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map(f => path.join(dir, f))
}
