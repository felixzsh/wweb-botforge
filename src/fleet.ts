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
import { setGlobalConfig } from './whatsapp/client'
import { getConfigPath } from './config/yaml'
import { getLogger } from './utils/logger'

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

      const configDir = path.dirname(getConfigPath())
      const flowStateDbPath = path.join(configDir, 'flows.db')
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

      for (const bot of loadedBots) {
        await this.initializeBot(bot)

        if (loadedBots.length > 1) {
          this.logger.info('Waiting 3 seconds before initializing next bot...')
          await this.delay(3000)
        }
      }

      this.isRunning = true
      this.logger.info(`WWeb BotForge started successfully with ${this.bots.size} bot(s)!`)
      this.logger.info('Bots are now listening for messages...')

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

  private async initializeBot(bot: Bot): Promise<void> {
    try {
      this.logger.info(`Initializing bot: ${bot.id} (${bot.id})`)

      this.bots.set(bot.id, bot)

      const channel = this.sessionManager.createChannel(bot.id)
      bot.channel = channel

      this.outboxService.setupBotQueue(bot)
      this.inboxService!.registerBot(bot)

      this.setupBotEventHandlers(bot)

      await bot.channel.connect()

      this.logger.info(`Bot "${bot.id}" initialized and ready`)

    } catch (error) {
      this.logger.error(`Failed to initialize bot "${bot.id}":`, error)
      throw error
    }
  }

  private setupBotEventHandlers(bot: Bot): void {
    if (!bot.channel) {
      throw new Error(`Bot "${bot.id}" does not have a registered channel`)
    }

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

      return {
        id: bot.id,
        name: bot.id,
        flowsCount: bot.flows.length,
        queue: {
          size: queueStatus.queueSize,
          delayMs: queueStatus.delayMs,
          isProcessing: queueStatus.isProcessing,
          hasCallback: queueStatus.hasCallback,
        },
      }
    })

    const queueStatus = this.outboxService.getAllQueuesStatus()

    return {
      isRunning: this.isRunning,
      bots: botStatuses,
      totalBots: botStatuses.length,
      queues: queueStatus,
    }
  }

  isRunningStatus(): boolean {
    return this.isRunning
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getOutboxService(): OutboxService {
    return this.outboxService
  }

  getBots(): Map<string, Bot> {
    return this.bots
  }

}
