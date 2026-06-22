import { Bot } from '../bot'
import { IncomingMessage } from './contracts'
import { FlowExecutor } from '../flow/executor'
import { getLogger } from '../utils/logger'

export class InboxService {
  private flowExecutor: FlowExecutor

  constructor(flowExecutor: FlowExecutor) {
    this.flowExecutor = flowExecutor
  }

  private get logger() {
    return getLogger()
  }

  registerBot(bot: Bot): void {
    if (!bot.channel) {
      throw new Error(`Bot "${bot.id}" does not have a registered channel`)
    }

    bot.channel.onMessage((message: IncomingMessage) => {
      this.handleIncomingMessage(bot, message)
    })

    bot.channel.onReady(() => {
      this.logger.info(`Bot "${bot.id}" is ready and listening for messages`)
    })
  }

  private async handleIncomingMessage(bot: Bot, message: IncomingMessage): Promise<void> {
    this.logger.info(`Message received for bot "${bot.id}": ${message.content.substring(0, 50)}...`)

    try {
      if (message.metadata?.fromMe) {
        return
      }

      if (this.isSenderIgnored(bot, message.from)) {
        this.logger.debug(`Ignoring message from "${message.from}" for bot "${bot.id}" (sender in ignored list)`)
        return
      }

      if (bot.settings.ignoreGroups && this.isGroupMessage(message.from)) {
        this.logger.debug(`Ignoring group message for bot "${bot.id}"`)
        return
      }

      await this.flowExecutor.handleMessage(bot, message)

    } catch (error) {
      this.logger.error(`Error handling message for bot "${bot.id}":`, error)
    }
  }

  private isSenderIgnored(bot: Bot, sender: string): boolean {
    return bot.settings.ignoredSenders.includes(sender)
  }

  private isGroupMessage(from: string): boolean {
    return from.includes('g.us')
  }
}
