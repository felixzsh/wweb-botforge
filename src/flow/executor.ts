import { Bot } from '../bot'
import { IncomingMessage, WebhookPayload } from '../messages/contracts'
import { ActionCatalog, ActionExecutionContext } from '../action/action'
import { FlowCatalog, FlowDef, FlowStep, FlowBranch, FlowState } from './flow'
import { executeAction, getAction } from '../action/action'
import { resolveVars } from '../action/action'
import { FlowStateService } from './state'
import { OutboxService } from '../messages/outbox'
import { CooldownService } from '../action/cooldown'
import { sendWebhookRequest } from '../action/webhook'
import { matchFuzzyVerbose } from '../helpers/fuzzy'
import { getLogger } from '../helpers/logger'

interface BranchMatch {
  branch: FlowBranch
  score: number
  nodeIndex: number
}

export class FlowExecutor {
  constructor(
    private actionCatalog: ActionCatalog,
    private flowCatalog: FlowCatalog,
    private flowStateService: FlowStateService,
    private outboxService: OutboxService,
    private defaultTimeout: number = 300,
    private cooldownService?: CooldownService
  ) {}

  private get logger() {
    return getLogger()
  }

  updateCatalogs(actionCatalog: ActionCatalog, flowCatalog: FlowCatalog): void {
    this.actionCatalog = actionCatalog
    this.flowCatalog = flowCatalog
  }

  async handleMessage(bot: Bot, message: IncomingMessage): Promise<boolean> {
    this.flowStateService.cleanupExpired()

    const state = this.flowStateService.findActive(message.from, bot.id)

    if (state) {
      return this.handleActiveState(bot, message, state)
    }

    return this.handleNewMessage(bot, message)
  }

  private async handleActiveState(
    bot: Bot,
    message: IncomingMessage,
    state: FlowState
  ): Promise<boolean> {
    const flow = this.flowCatalog.get(state.flowId)
    if (!flow) {
      this.flowStateService.destroy(state.id)
      return false
    }

    const currentStep = flow.steps[state.stepId]
    if (!currentStep) {
      this.flowStateService.destroy(state.id)
      return false
    }

    this.logger.debug(`[active] flow="${flow.id}" step="${state.stepId}" action="${currentStep.action}"`)
    this.logger.debug(`  message: "${message.content}" from "${message.from}"`)

    const match = this.findBestBranch(flow, state, message.content)

    if (!match) {
      if (flow.fallbackStep && flow.steps[flow.fallbackStep]) {
        await this.transitionToStep(bot, message, state, flow, flow.fallbackStep)
        return true
      }

      this.logger.debug(`  no branch matched, ignoring`)
      return true
    }

    this.logger.debug(`  >> goto="${match.branch.goto}" | node=${match.nodeIndex} score=${match.score.toFixed(3)}`)

    await this.transitionToStep(bot, message, state, flow, match.branch.goto)
    return true
  }

  private async handleNewMessage(bot: Bot, message: IncomingMessage): Promise<boolean> {
    const flowRefs = [...bot.flows].sort((a, b) => b.priority - a.priority)

    for (const flowRef of flowRefs) {
      const flow = this.flowCatalog.get(flowRef.id)
      if (!flow) {
        this.logger.warn(`Flow "${flowRef.id}" referenced by bot "${bot.id}" not found`)
        continue
      }

      const entryStep = flow.steps[flow.entryStep]
      if (!entryStep) {
        this.logger.warn(`Entry step "${flow.entryStep}" for flow "${flow.id}" not found`)
        continue
      }

      if (!this.matchesFlowTriggers(flow, message.content)) {
        this.logger.debug(`new: flow "${flow.id}" triggers no match, skip`)
        continue
      }

      this.logger.debug(`new: flow "${flow.id}" matched, enter "${flow.entryStep}"`)

      const consumed = await this.executeStepAction(bot, message, entryStep, {})

      if (!consumed) {
        return false
      }

      if (entryStep.branches.length === 0) {
        this.flowStateService.destroyBySenderBot(message.from, bot.id)
      } else {
        const timeout = flow.timeout ?? this.defaultTimeout
        this.flowStateService.create(
          message.from, bot.id, flow.id, flow.entryStep, timeout,
          Date.now(), { __visitedSteps: [] }
        )
      }

      return true
    }

    return false
  }

  private async transitionToStep(
    bot: Bot,
    message: IncomingMessage,
    state: FlowState,
    flow: FlowDef,
    stepId: string
  ): Promise<void> {
    const step = flow.steps[stepId]
    if (!step) {
      this.logger.error(`Step "${stepId}" not found in flow "${flow.id}"`)
      this.flowStateService.destroy(state.id)
      return
    }

    const vars = { ...state.variables }
    const visited: string[] = vars.__visitedSteps ?? []

    if (stepId === flow.entryStep) {
      vars.__visitedSteps = []
    } else if (stepId !== state.stepId) {
      const prevStep = flow.steps[state.stepId]
      const hasNavBranches = prevStep?.branches.some(b => b.when && b.when.length > 0)

      if (hasNavBranches) {
        if (visited.includes(state.stepId)) {
          const reordered = visited.filter(s => s !== state.stepId)
          vars.__visitedSteps = [...reordered, state.stepId]
        } else {
          vars.__visitedSteps = [...visited, state.stepId]
        }
      }
    }

    await this.executeStepAction(bot, message, step, vars)

    if (step.branches.length === 0) {
      this.flowStateService.destroy(state.id)
    } else {
      this.flowStateService.updateStep(state.id, stepId, vars)
      this.logger.debug(`  visited updated: [${(vars.__visitedSteps ?? []).join(', ')}]`)
    }
  }

  private findBestBranch(
    flow: FlowDef,
    state: FlowState,
    message: string
  ): BranchMatch | null {
    const visited: string[] = state.variables?.__visitedSteps ?? []
    const currentStep = flow.steps[state.stepId]

    if (!currentStep) return null

    this.logger.debug(`  context: "${message}"`)
    this.logger.debug(`  current: ${state.stepId} | visited: [${visited.join(', ')}]`)

    const nodes: { branches: FlowBranch[]; stepName: string }[] = []

    const allStepNames = [...new Set([...visited, state.stepId])]

    for (const stepName of allStepNames) {
      const step = flow.steps[stepName]
      if (step && stepName !== state.stepId) {
        nodes.push({ branches: step.branches, stepName })
      }
    }

    nodes.push({ branches: currentStep.branches, stepName: state.stepId })

    let best: BranchMatch | null = null

    for (let ni = 0; ni < nodes.length; ni++) {
      const node = nodes[ni]
      const branchList = node.branches || []

      const condBranches = branchList.filter(b => b.when && b.when.length > 0)

      if (condBranches.length === 0) {
        this.logger.debug(`    Node ${ni} ${node.stepName}: 0 conditional branches`)
        continue
      }

      this.logger.debug(`    Node ${ni} ${node.stepName} — ${condBranches.length} branches:`)

      for (let bi = 0; bi < condBranches.length; bi++) {
        const branch = condBranches[bi]
        const threshold = branch.fuzzyThreshold ?? 0.6

        const result = matchFuzzyVerbose(branch.when!, message, threshold)
        if (!result) {
          this.logger.debug(`      [${bi}] when="${branch.when!.join(', ')}" → ${branch.goto}`)
          continue
        }

        const isBest = !best ||
          result.score < best.score ||
          (result.score === best.score && ni > best.nodeIndex)

        const marker = isBest ? '◀ BEST' : '◀ worse'
        this.logger.debug(`      [${bi}] when="${branch.when!.join(', ')}" → ${branch.goto} | match="${result.match}" score=${result.score.toFixed(3)} ${marker}`)

        if (isBest) {
          best = { branch, score: result.score, nodeIndex: ni }
        }
      }
    }

    if (best) {
      this.logger.debug(`    >> winner: Node ${best.nodeIndex} goto="${best.branch.goto}" score=${best.score.toFixed(3)}`)
      return best
    }

    const defaultBranch = currentStep.branches.find(b => !b.when || b.when.length === 0)
    if (defaultBranch) {
      this.logger.debug(`    >> default → goto="${defaultBranch.goto}"`)
      return { branch: defaultBranch, score: 1, nodeIndex: nodes.length - 1 }
    }

    this.logger.debug(`    >> no match`)
    return null
  }

  private matchesFlowTriggers(flow: FlowDef, message: string): boolean {
    if (!flow.triggers || flow.triggers.length === 0) {
      return false
    }

    this.logger.debug(`  triggers: flow="${flow.id}" ${flow.triggers.length} triggers`)

    for (let i = 0; i < flow.triggers.length; i++) {
      const trigger = flow.triggers[i]
      const threshold = trigger.fuzzyThreshold ?? 0.6

      const result = matchFuzzyVerbose(trigger.phrases, message, threshold)
      if (result) {
        this.logger.debug(`    [${i}] MATCH: "${result.match}" score=${result.score.toFixed(3)}`)
        return true
      }
    }

    return false
  }

  private async executeStepAction(
    bot: Bot,
    message: IncomingMessage,
    step: FlowStep,
    variables: Record<string, any>
  ): Promise<boolean> {
    const context: ActionExecutionContext = {
      botId: bot.id,
      botName: bot.id,
      sender: message.from,
      message: message.content,
      variables,
    }

    if (this.isActionOnCooldown(bot, step.action, message.from)) {
      const action = getAction(this.actionCatalog, step.action)
      if (action.cooldownReply) {
        const reply = resolveVars(action.cooldownReply, context)
        this.outboxService.enqueue(bot.id, message.from, reply)
        this.logger.info(`Cooldown reply sent for action "${step.action}" to ${message.from}`)
        return true
      }
      this.logger.warn(`Action "${step.action}" on cooldown, no cooldown_reply defined, skipping`)
      return false
    }

    const result = executeAction(this.actionCatalog, step.action, context)
    this.setActionCooldown(step.action, message.from)

    if (result.reply) {
      this.outboxService.enqueue(bot.id, message.from, result.reply)
    }

    if (result.webhook) {
      try {
        const payload = this.buildWebhookPayload(bot, message, result.webhook.name || 'unnamed')
        await sendWebhookRequest({
          url: result.webhook.url,
          method: result.webhook.method,
          headers: result.webhook.headers,
          body: payload,
          timeout: result.webhook.timeout,
          retries: result.webhook.retries,
        })
      } catch (error) {
        this.logger.error(`Failed to trigger webhook action for bot "${bot.id}":`, error)
      }
    }

    return true
  }

  private isActionOnCooldown(bot: Bot, actionId: string, sender: string): boolean {
    if (!this.cooldownService) {
      return false
    }

    const action = getAction(this.actionCatalog, actionId)
    if (!action.cooldown || action.cooldown <= 0) {
      return false
    }

    const cooldownMs = action.cooldown * 1000
    const cooldownKey = `action:${actionId}`

    return this.cooldownService.isOnCooldown(sender, cooldownKey, cooldownMs)
  }

  private setActionCooldown(actionId: string, sender: string): void {
    if (!this.cooldownService) {
      return
    }

    const action = getAction(this.actionCatalog, actionId)
    if (!action.cooldown || action.cooldown <= 0) {
      return
    }

    this.cooldownService.setCooldown(sender, `action:${actionId}`)
  }

  private buildWebhookPayload(bot: Bot, message: IncomingMessage, webhookName: string): WebhookPayload {
    return {
      sender: message.from,
      message: message.content,
      timestamp: message.timestamp.toISOString(),
      botId: bot.id,
      botName: bot.id,
      webhookName,
      metadata: message.metadata || {},
    }
  }
}
