import { Bot, AutoResponse, IncomingMessage, OutgoingMessage } from '../bot/types'
import { CooldownService } from './cooldown'
import { getLogger } from '../utils/logger'

export class AutoResponseService {
  private cooldownService: CooldownService

  constructor(cooldownService: CooldownService) {
    this.cooldownService = cooldownService
  }

  private get logger() {
    return getLogger()
  }

  processMessage(bot: Bot, message: IncomingMessage): AutoResponse | null {
    this.cooldownService.cleanupExpiredCooldowns()

    if (message.metadata?.fromMe) {
      return null
    }

    if (bot.settings.ignoreGroups && this.isGroupMessage(message.from)) {
      this.logger.debug(`🚫 Ignoring group message for bot "${bot.name}"`)
      return null
    }

    const sorted = [...bot.autoResponses].sort((a, b) => b.priority - a.priority)
    const matchingResponse = sorted.find(response => response.pattern.test(message.content))

    if (matchingResponse) {
      const cooldownMs = (matchingResponse.cooldown || 0) * 1000
      const patternKey = matchingResponse.patternString
      if (this.cooldownService.isOnCooldown(message.from, patternKey, cooldownMs)) {
        this.logger.debug(`⏳ Cooldown active for sender "${message.from}" on pattern "${patternKey}" in bot "${bot.name}"`)
        return null
      }

      this.cooldownService.setCooldown(message.from, patternKey)

      this.logger.info(`🤖 Auto-response triggered for bot "${bot.name}": "${patternKey}" → "${matchingResponse.response}"`)
      return matchingResponse
    }

    return null
  }

  shouldProcessMessage(bot: Bot, message: IncomingMessage): boolean {
    if (message.metadata?.fromMe) {
      return false
    }

    if (bot.settings.ignoreGroups && this.isGroupMessage(message.from)) {
      return false
    }

    return true
  }

  private isGroupMessage(from: string): boolean {
    return from.includes('g.us')
  }

  sendAutoResponse(
    messageQueue: { enqueue: (botId: string, to: string, content: string, metadata?: any) => string },
    bot: Bot,
    originalMessage: IncomingMessage,
    autoResponse: AutoResponse
  ): string {
    try {
      const metadata = autoResponse.responseOptions || {}

      const messageId = messageQueue.enqueue(
        bot.id,
        originalMessage.from,
        autoResponse.response,
        metadata
      )

      this.logger.info(`📤 Auto-response queued for bot "${bot.name}" with ID: ${messageId}`)
      return messageId
    } catch (error) {
      this.logger.error(`❌ Error sending auto-response for bot "${bot.name}":`, error)
      throw error
    }
  }
}
