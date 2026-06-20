import { Bot, IncomingMessage, AutoResponse } from '../bot/types'
import { AutoResponseService } from './auto-response'
import { WebhookService } from './webhook'
import { CooldownService } from './cooldown'
import { getLogger } from '../utils/logger'

export type InboxCallback = (bot: Bot, message: IncomingMessage, response?: string) => void

export class InboxService {
  private bots: Map<string, Bot> = new Map()
  private handlers: Map<string, InboxCallback> = new Map()
  private autoResponseService: AutoResponseService
  private webhookService: WebhookService

  constructor(cooldownService: CooldownService) {
    this.autoResponseService = new AutoResponseService(cooldownService)
    this.webhookService = new WebhookService(cooldownService)
  }

  private get logger() {
    return getLogger()
  }

  registerBot(bot: Bot): void {
    if (!bot.channel) {
      throw new Error(`Bot "${bot.name}" does not have a registered channel`)
    }

    this.bots.set(bot.id, bot)

    bot.channel.onMessage((message: IncomingMessage) => {
      this.handleIncomingMessage(bot, message)
    })

    bot.channel.onReady(() => {
      this.logger.info(`🤖 Bot "${bot.name}" (${bot.id}) is ready and listening for messages`)
    })
  }

  unregisterBot(botId: string): void {
    this.bots.delete(botId)
    this.handlers.delete(botId)
  }

  registerMessageHandler(botId: string, handler: InboxCallback): void {
    this.handlers.set(botId, handler)
  }

  private async handleIncomingMessage(bot: Bot, message: IncomingMessage): Promise<void> {
    this.logger.info(`📨 Message received for bot "${bot.name}": ${message.content.substring(0, 50)}...`)

    try {
      if (this.isSenderIgnored(bot, message.from)) {
        this.logger.debug(`🚫 Ignoring message from "${message.from}" for bot "${bot.name}" (sender in ignored list)`)
        return
      }

      if (!this.autoResponseService.shouldProcessMessage(bot, message)) {
        return
      }

      const autoResponse = this.autoResponseService.processMessage(bot, message)

      if (autoResponse) {
        this.autoResponseService.sendAutoResponse(
          { enqueue: () => '' },
          bot,
          message,
          autoResponse
        )
      }

      this.webhookService.processWebhooks(bot, message).catch(error => {
        this.logger.error(`❌ Error processing webhooks for bot "${bot.name}":`, error)
      })

      const customHandler = this.handlers.get(bot.id)
      if (customHandler) {
        customHandler(bot, message, autoResponse?.response)
      }

    } catch (error) {
      this.logger.error(`❌ Error handling message for bot "${bot.name}":`, error)
    }
  }

  getRegisteredBots(): Bot[] {
    return Array.from(this.bots.values())
  }

  isBotRegistered(botId: string): boolean {
    return this.bots.has(botId)
  }

  getBot(botId: string): Bot | undefined {
    return this.bots.get(botId)
  }

  private isSenderIgnored(bot: Bot, sender: string): boolean {
    return bot.settings.ignoredSenders.includes(sender)
  }

  getAutoResponseService(): AutoResponseService {
    return this.autoResponseService
  }
}
