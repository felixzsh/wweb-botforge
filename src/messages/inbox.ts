import { Bot } from '../bot'
import { IncomingMessage } from './contracts'
import { FlowExecutor } from '../flow/executor'
import { getLogger } from '../helpers/logger'

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
      console.error('[DEBUG inbox] registerBot onReady FIRED for', bot.id)
      this.logger.info(`Bot "${bot.id}" is ready and listening for messages`)
    })
  }

  private async handleIncomingMessage(bot: Bot, message: IncomingMessage): Promise<void> {
    console.error('[DEBUG inbox] handleIncomingMessage ENTER:', bot.id, message.from, message.content?.substring(0, 40))
    this.logger.info(`Message received for bot "${bot.id}": ${message.content.substring(0, 50)}...`)

    try {
      if (message.metadata?.fromMe) {
        console.error('[DEBUG inbox] filtered by fromMe')
        return
      }

      if (this.isSenderIgnored(bot, message.from)) {
        console.error('[DEBUG inbox] filtered by ignoredSender:', message.from)
        this.logger.debug(`Ignoring message from "${message.from}" for bot "${bot.id}" (sender in ignored list)`)
        return
      }

      if (bot.settings.ignoreGroups && this.isGroupMessage(message.from)) {
        console.error('[DEBUG inbox] filtered by group:', message.from)
        this.logger.debug(`Ignoring group message for bot "${bot.id}"`)
        return
      }

      console.error('[DEBUG inbox] passing to flowExecutor')
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
