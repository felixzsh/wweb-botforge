import * as path from 'path'
import { Bot } from './bot'
import { ConfigFile } from './config/schema'
import { mapBotsFromConfig, mapActionCatalog, mapFlowCatalog } from './config/mapper'
import { ActionCatalog } from './action/action'
import { FlowCatalog } from './flow/flow'
import { CooldownService } from './action/cooldown'
import { OutboxService } from './messages/outbox'
import { InboxService } from './messages/inbox'
import { FlowStateService } from './flow/state'
import { FlowExecutor } from './flow/executor'
import { SessionManager } from './whatsapp/session'
import { setGlobalConfig, getWwebCacheDir } from './whatsapp/client'
import { MessageChannel } from './messages/contracts'
import { getLogger } from './helpers/logger'

export class BotFleet {
  private bots: Map<string, Bot> = new Map()
  private cooldownService: CooldownService
  private outboxService: OutboxService
  private inboxService?: InboxService
  private sessionManager: SessionManager
  private actionCatalog: ActionCatalog = new Map()
  private flowCatalog: FlowCatalog = new Map()
  private flowStateService?: FlowStateService
  private flowExecutor?: FlowExecutor
  private isRunning: boolean = false

  constructor(outboxService: OutboxService) {
    this.sessionManager = SessionManager.getInstance()
    this.outboxService = outboxService
    this.cooldownService = new CooldownService()
  }

  private get logger() {
    return getLogger()
  }

  async start(configFile: ConfigFile): Promise<Map<string, Bot>> {
    if (this.isRunning) {
      this.logger.info('Bot Fleet Launcher is already running')
      return this.bots
    }

    try {
      this.actionCatalog = mapActionCatalog(configFile.actions || {})
      this.flowCatalog = mapFlowCatalog(configFile.flows || {})

      const flowStateDbPath = path.join(getWwebCacheDir(), 'flows.db')
      this.flowStateService = new FlowStateService(flowStateDbPath)

      const flowStateTimeout = configFile.global?.sessionTimeout ?? 300
      this.flowExecutor = new FlowExecutor(
        this.actionCatalog,
        this.flowCatalog,
        this.flowStateService,
        this.outboxService,
        flowStateTimeout,
        this.cooldownService
      )

      this.inboxService = new InboxService(this.flowExecutor)

      if (Object.keys(configFile.bots).length === 0) {
        this.logger.warn('No bots configured.')
        return this.bots
      }

      const loadedBots = mapBotsFromConfig(configFile.bots)

      this.logger.debug(`Initializing ${loadedBots.length} bot(s)...`)

      for (const bot of loadedBots) {
        this.logger.debug("about to initialize a bot")
        this.registerBot(bot)
      }

      this.isRunning = true
      this.logger.info('Waiting for bot connections...')

      this.setupGracefulShutdown()

      return this.bots

    } catch (error) {
      this.logger.error('Failed to start Bot Fleet Launcher:', error)
      throw error
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    this.logger.info('Stopping WWeb BotForge...')

    try {
      await this.outboxService.shutdown()
      await this.sessionManager.removeAllChannels()
      this.flowStateService?.close()
      this.bots.clear()

      this.isRunning = false
      this.logger.info('WWeb BotForge stopped successfully')
    } catch (error) {
      this.logger.error('Error stopping Bot Fleet:', error)
      throw error
    }
  }

  private registerBot(bot: Bot): void {
    this.logger.info(`Registering bot: ${bot.id}`)
    this.bots.set(bot.id, bot)
    this.outboxService.setupBotQueue(bot)

    this.sessionManager.onSessionReady(bot.id, (channel) => {
      this.linkSessionToBot(bot, channel)
    })

    this.sessionManager.registerSession(bot.id).catch((err) => {
      this.logger.warn(`Bot "${bot.id}" session registration failed: ${err.message}`)
    })
  }

  private linkSessionToBot(bot: Bot, channel: MessageChannel): void {
    bot.channel = channel
    this.inboxService!.registerBot(bot)
    this.setupBotEventHandlers(bot)

    const phone = channel.getPhone()
    if (phone) {
      bot.phone = phone
    }

    this.logger.info(`Bot "${bot.id}" linked to session`)
  }

  private setupBotEventHandlers(bot: Bot): void {
    if (!bot.channel) return

    bot.channel.onReady(() => {
      this.logger.info(`Bot "${bot.id}" is ready!`)
      const phone = bot.channel!.getPhone()
      if (phone) {
        bot.phone = phone
      }
    })

    bot.channel.onDisconnected((reason: string) => {
      this.logger.warn(`Bot "${bot.id}" disconnected:`, reason)
    })

    bot.channel.onAuthFailure((error: Error) => {
      this.logger.error(`Bot "${bot.id}" authentication failed:`, error.message)
    })

    bot.channel.onConnectionError((error: Error) => {
      this.logger.error(`Bot "${bot.id}" connection error:`, error.message)
    })

    bot.channel.onStateChange((state: string) => {
      this.logger.info(`Bot "${bot.id}" state changed to:`, state)
    })

    bot.channel.onAuthRequired?.((info) => {
      this.logger.info(`QR auth required for bot "${bot.id}"`)
    })
  }

  linkExistingSession(botId: string): void {
    const bot = this.bots.get(botId)
    if (!bot) {
      this.logger.warn(`Cannot link session: bot "${botId}" not found`)
      return
    }
    const channel = this.sessionManager.getChannel(botId)
    if (!channel) {
      this.logger.warn(`Cannot link session: no session for "${botId}"`)
      return
    }
    this.linkSessionToBot(bot, channel)
  }

  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      this.logger.info('\nReceived shutdown signal...')
      await this.stop()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    process.on('SIGUSR2', shutdown)

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception:', error)
      this.stop().finally(() => process.exit(1))
    })

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
      this.stop().finally(() => process.exit(1))
    })
  }

  getStatus(): any {
    const botStatuses = Array.from(this.bots.values()).map(bot => {
      const queueStatus = this.outboxService.getBotQueueStatus(bot.id)
      const sessionInfo = this.sessionManager.getSessionInfo(bot.id)

      return {
        id: bot.id,
        flowsCount: bot.flows.length,
        session: sessionInfo ? {
          state: sessionInfo.state,
          phone: sessionInfo.phone,
        } : null,
        queue: {
          size: queueStatus.queueSize,
          delayMs: queueStatus.delayMs,
          isProcessing: queueStatus.isProcessing,
          hasCallback: queueStatus.hasCallback,
        },
      }
    })

    return {
      isRunning: this.isRunning,
      bots: botStatuses,
      totalBots: botStatuses.length,
    }
  }

  isRunningStatus(): boolean {
    return this.isRunning
  }

  getOutboxService(): OutboxService {
    return this.outboxService
  }

  getBots(): Map<string, Bot> {
    return this.bots
  }

  getActionCatalog(): ActionCatalog {
    return this.actionCatalog
  }

  setActionCatalog(catalog: ActionCatalog): void {
    this.actionCatalog = catalog
  }

  getFlowCatalog(): FlowCatalog {
    return this.flowCatalog
  }

  setFlowCatalog(catalog: FlowCatalog): void {
    this.flowCatalog = catalog
  }
}
