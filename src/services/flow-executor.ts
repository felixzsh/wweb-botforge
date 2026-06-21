import { Bot, IncomingMessage, WebhookPayload } from '../bot/types'
import { ActionCatalog, ActionExecutionContext } from '../action/types'
import { FlowCatalog, FlowDef, FlowStep, FlowBranch, FlowState } from '../flow/types'
import { executeAction, getAction } from '../action/executor'
import { resolveVars } from '../action/template'
import { FlowStateService } from './flow-state'
import { OutboxService } from './outbox'
import { CooldownService } from './cooldown'
import { sendWebhookRequest } from '../utils/webhook'
import { matchFuzzy } from '../bot/fuzzy'
import { getLogger } from '../utils/logger'

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

    const branch = this.findMatchingBranch(currentStep.branches, message.content)

    if (!branch) {
      if (flow.fallbackStep && flow.steps[flow.fallbackStep]) {
        await this.transitionToStep(bot, message, state, flow, flow.fallbackStep)
        return true
      }

      this.logger.debug(`No branch matched for flow state ${state.id}, ignoring message`)
      return true
    }

    await this.transitionToStep(bot, message, state, flow, branch.goto)
    return true
  }

  private async handleNewMessage(bot: Bot, message: IncomingMessage): Promise<boolean> {
    const behaviors = [...bot.behaviors].sort((a, b) => b.priority - a.priority)

    for (const behavior of behaviors) {
      const flow = this.flowCatalog.get(behavior.flowId)
      if (!flow) {
        this.logger.warn(`Flow "${behavior.flowId}" referenced by bot "${bot.name}" not found`)
        continue
      }

      const entryStep = flow.steps[flow.entry]
      if (!entryStep) {
        this.logger.warn(`Entry step "${flow.entry}" for flow "${flow.id}" not found`)
        continue
      }

      if (!this.matchesTriggers(entryStep, message.content)) {
        continue
      }

      const consumed = await this.executeStepAction(bot, message, entryStep, {})

      if (!consumed) {
        return false
      }

      if (entryStep.branches.length === 0) {
        this.flowStateService.destroyBySenderBot(message.from, bot.id)
      } else {
        const timeout = flow.timeout ?? this.defaultTimeout
        this.flowStateService.create(message.from, bot.id, flow.id, flow.entry, timeout)
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

    await this.executeStepAction(bot, message, step, state.variables)

    if (step.branches.length === 0) {
      this.flowStateService.destroy(state.id)
    } else {
      this.flowStateService.updateStep(state.id, stepId, state.variables)
    }
  }

  private async executeStepAction(
    bot: Bot,
    message: IncomingMessage,
    step: FlowStep,
    variables: Record<string, any>
  ): Promise<boolean> {
    const context: ActionExecutionContext = {
      botId: bot.id,
      botName: bot.name,
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
        this.logger.error(`Failed to trigger webhook action for bot "${bot.name}":`, error)
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

  private findMatchingBranch(branches: FlowBranch[], message: string): FlowBranch | null {
    const defaultBranch = branches.find(branch => !branch.when || branch.when.length === 0)
    const conditionalBranches = branches.filter(branch => branch.when && branch.when.length > 0)

    for (const branch of conditionalBranches) {
      const threshold = branch.fuzzyThreshold ?? 0.6
      if (matchFuzzy(branch.when!, message, threshold)) {
        return branch
      }
    }

    return defaultBranch || null
  }

  private matchesTriggers(step: FlowStep, message: string): boolean {
    if (!step.triggers || step.triggers.length === 0) {
      return false
    }

    return step.triggers.some(trigger => {
      const threshold = trigger.fuzzyThreshold ?? 0.6
      return matchFuzzy(trigger.phrases, message, threshold) !== null
    })
  }

  private buildWebhookPayload(bot: Bot, message: IncomingMessage, webhookName: string): WebhookPayload {
    return {
      sender: message.from,
      message: message.content,
      timestamp: message.timestamp.toISOString(),
      botId: bot.id,
      botName: bot.name,
      webhookName,
      webhookPattern: '',
      metadata: message.metadata || {},
    }
  }
}
