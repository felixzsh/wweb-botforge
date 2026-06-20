import { Bot, Webhook, IncomingMessage, WebhookPayload } from '../bot/types'
import { CooldownService } from './cooldown'
import { matchFuzzy } from '../bot/fuzzy'
import { getLogger } from '../utils/logger'

export class WebhookService {
  private cooldownService: CooldownService

  constructor(cooldownService: CooldownService) {
    this.cooldownService = cooldownService
  }

  private get logger() {
    return getLogger()
  }

  async processWebhooks(bot: Bot, message: IncomingMessage): Promise<void> {
    if (message.metadata?.fromMe) {
      return
    }

    const sorted = [...bot.webhooks].sort((a, b) => b.priority - a.priority)
    const matchingWebhooks = sorted.filter(webhook =>
      matchFuzzy(webhook.fuzzySegments, message.content, webhook.fuzzyThreshold)
    )

    if (matchingWebhooks.length === 0) {
      return
    }

    for (const webhook of matchingWebhooks) {
      try {
        await this.triggerWebhook(bot, message, webhook)
      } catch (error) {
        this.logger.error(`❌ Failed to trigger webhook "${webhook.name}" for bot "${bot.name}":`, error)
      }
    }
  }

  private async triggerWebhook(
    bot: Bot,
    message: IncomingMessage,
    webhook: Webhook
  ): Promise<void> {
    const cooldownMs = (webhook.cooldown || 0) * 1000
    const senderKey = message.from

    if (this.cooldownService.isOnCooldown(senderKey, webhook.name, cooldownMs)) {
      this.logger.debug(`⏳ Webhook cooldown active for sender "${senderKey}" on webhook "${webhook.name}" in bot "${bot.name}"`)
      return
    }

    this.cooldownService.setCooldown(senderKey, webhook.name)

    this.logger.info(`🔗 Triggering webhook "${webhook.name}" for bot "${bot.name}": ${webhook.method} ${webhook.url}`)

    const payload = this.buildWebhookPayload(bot, message, webhook)

    await this.makeHttpRequest(webhook, payload)
  }

  private buildWebhookPayload(bot: Bot, message: IncomingMessage, webhook: Webhook): WebhookPayload {
    return {
      sender: message.from,
      message: message.content,
      timestamp: message.timestamp.toISOString(),
      botId: bot.id,
      botName: bot.name,
      webhookName: webhook.name,
      webhookPattern: webhook.patternString,
      metadata: message.metadata || {},
    }
  }

  private async makeHttpRequest(webhook: Webhook, payload: any): Promise<void> {
    const maxRetries = webhook.retries || 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(webhook.url, {
          method: webhook.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(webhook.headers || {}),
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(webhook.timeout || 5000),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        this.logger.info(`✅ Webhook request successful: ${webhook.url}`)
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000
          this.logger.warn(`⚠️ Webhook request failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms:`, lastError.message)
          await new Promise(resolve => setTimeout(resolve, backoffMs))
        }
      }
    }

    throw new Error(`Webhook request failed after ${maxRetries} attempts: ${lastError?.message}`)
  }
}
