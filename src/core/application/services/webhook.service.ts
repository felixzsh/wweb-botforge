import { Bot } from '../../domain/entities/bot.entity';
import { Webhook } from '../../domain/value-objects/webhook.vo';
import { IncomingMessage } from '../../domain/value-objects/incoming-message.vo';
import { CooldownService } from './cooldown.service';
import { getLogger } from '../../infrastructure/logger';

/**
 * Service for handling outbound webhooks triggered by message patterns
 */
export class WebhookService {
  constructor(private cooldownService: CooldownService) {}

  private get logger() {
    return getLogger();
  }

  /**
   * Process webhooks for a message that matches patterns
   */
  async processWebhooks(bot: Bot, message: IncomingMessage): Promise<void> {
    // Skip messages from the bot itself
    if (message.metadata?.fromMe) {
      return;
    }

    // Find matching webhooks
    const matchingWebhooks = bot.findMatchingWebhooks(message.content);

    if (matchingWebhooks.length === 0) {
      return;
    }

    // Process each matching webhook
    for (const webhook of matchingWebhooks) {
      try {
        await this.triggerWebhook(bot, message, webhook);
      } catch (error) {
        this.logger.error(`❌ Failed to trigger webhook "${webhook.name}" for bot "${bot.name}":`, error);
      }
    }
  }

  /**
   * Trigger a single webhook with cooldown checking
   */
  private async triggerWebhook(
    bot: Bot,
    message: IncomingMessage,
    webhook: Webhook
  ): Promise<void> {
    // Check cooldown (convert seconds to milliseconds)
    const cooldownMs = (webhook.cooldown || 0) * 1000;
    const senderKey = message.from.getValue();
    
    if (this.cooldownService.isOnCooldown(senderKey, webhook.name, cooldownMs)) {
      this.logger.debug(`⏳ Webhook cooldown active for sender "${senderKey}" on webhook "${webhook.name}" in bot "${bot.name}"`);
      return;
    }

    // Set cooldown timestamp
    this.cooldownService.setCooldown(senderKey, webhook.name);

    this.logger.info(`🔗 Triggering webhook "${webhook.name}" for bot "${bot.name}": ${webhook.method} ${webhook.url}`);

    // Prepare webhook payload
    const payload = this.buildWebhookPayload(bot, message, webhook);

    // Make HTTP request with retry logic
    await this.makeHttpRequest(webhook, payload);
  }

  /**
   * Build the webhook payload from message data
   */
  private buildWebhookPayload(bot: Bot, message: IncomingMessage, webhook: Webhook): any {
    return {
      // Message data
      sender: message.from.getValue(),
      message: message.content,
      timestamp: message.timestamp,

      // Bot context
      botId: bot.id.value,
      botName: bot.name,

      // Webhook context
      webhookName: webhook.name,
      webhookPattern: webhook.pattern.getPattern(),

      // Additional metadata
      metadata: message.metadata || {}
    };
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeHttpRequest(webhook: Webhook, payload: any): Promise<void> {
    const maxRetries = webhook.retries || 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(webhook.url, {
          method: webhook.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(webhook.headers || {})
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(webhook.timeout || 5000)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        this.logger.info(`✅ Webhook request successful: ${webhook.url}`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          this.logger.warn(`⚠️ Webhook request failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw new Error(`Webhook request failed after ${maxRetries} attempts: ${lastError?.message}`);
  }
}
