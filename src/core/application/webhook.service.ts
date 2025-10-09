import { Bot } from '../domain/entities/bot.entity';
import { WebhookData } from '../domain/dtos/config.dto';
import { IncomingMessage } from '../domain/dtos/message.dto';
import { CooldownService } from './cooldown.service';

/**
 * Service for handling outbound webhooks triggered by message patterns
 */
export class WebhookService {
  constructor(private cooldownService: CooldownService) {}

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
        console.error(`❌ Failed to trigger webhook "${webhook.name}" for bot "${bot.name}":`, error);
      }
    }
  }

  /**
   * Trigger a single webhook with cooldown checking
   */
  private async triggerWebhook(
    bot: Bot,
    message: IncomingMessage,
    webhook: WebhookData
  ): Promise<void> {
    // Check cooldown (convert seconds to milliseconds)
    const cooldownMs = (webhook.cooldown || 0) * 1000;
    if (this.cooldownService.isOnCooldown(message.from, webhook.name, cooldownMs)) {
      console.log(`⏳ Webhook cooldown active for sender "${message.from}" on webhook "${webhook.name}" in bot "${bot.name}"`);
      return;
    }

    // Set cooldown timestamp
    this.cooldownService.setCooldown(message.from, webhook.name);

    console.log(`🔗 Triggering webhook "${webhook.name}" for bot "${bot.name}": ${webhook.method} ${webhook.url}`);

    // Prepare webhook payload
    const payload = this.buildWebhookPayload(bot, message, webhook);

    // Make HTTP request with retry logic
    await this.makeHttpRequest(webhook, payload);
  }

  /**
   * Build the webhook payload from message data
   */
  private buildWebhookPayload(bot: Bot, message: IncomingMessage, webhook: WebhookData): any {
    return {
      // Message data
      sender: message.from,
      message: message.content,
      timestamp: message.timestamp,

      // Bot context
      botId: bot.id.value,
      botName: bot.name,

      // Webhook metadata
      webhookName: webhook.name,
      webhookPattern: webhook.pattern,

      // Additional metadata
      metadata: message.metadata || {}
    };
  }

  /**
   * Make HTTP request to webhook URL with retry logic
   */
  private async makeHttpRequest(webhook: WebhookData, payload: any): Promise<void> {
    const maxRetries = webhook.retry || 3;
    const timeout = webhook.timeout || 5000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(webhook.url, {
          method: webhook.method,
          headers: {
            'Content-Type': 'application/json',
            ...webhook.headers
          },
          body: webhook.method !== 'GET' ? JSON.stringify(payload) : undefined,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log(`✅ Webhook "${webhook.name}" triggered successfully (attempt ${attempt}/${maxRetries})`);
        return;

      } catch (error) {
        console.warn(`⚠️ Webhook "${webhook.name}" attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt === maxRetries) {
          throw new Error(`Webhook "${webhook.name}" failed after ${maxRetries} attempts: ${error}`);
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await this.delay(delay);
      }
    }
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}