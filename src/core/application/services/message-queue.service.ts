import { Bot } from '../../domain/entities/bot.entity';
import { OutgoingMessage } from '../../domain/value-objects/outgoing-message.vo';
import { getLogger } from '../../infrastructure/utils/logger';

/**
 * Represents a message in the queue
 */
export interface QueuedMessage {
  id: string;
  botId: string;
  message: OutgoingMessage;
  timestamp: number;
}

/**
 * Callback type for sending messages
 */
export type SendMessageCallback = (botId: string, message: OutgoingMessage) => Promise<void>;

/**
 * Message queue service that manages delayed responses for multiple bots
 * Each bot can have its own queue with configurable delays
 */
export class MessageQueueService {
  private queues: Map<string, QueuedMessage[]> = new Map();
  private processing: Map<string, boolean> = new Map();
  private delays: Map<string, number> = new Map();
  private sendCallbacks: Map<string, SendMessageCallback> = new Map();

  private get logger() {
    return getLogger();
  }

  /**
   * Set delay for a specific bot (in milliseconds)
   */
  setBotDelay(botId: string, delayMs: number): void {
    this.delays.set(botId, delayMs);
    this.logger.info(`📋 Queue delay for bot "${botId}" set to ${delayMs}ms`);
  }

  /**
    * Set send callback for a specific bot
    */
   setBotSendCallback(botId: string, callback: SendMessageCallback): void {
     this.sendCallbacks.set(botId, callback);
   }

  /**
    * Setup message queue for a specific bot
    */
   setupBotQueue(bot: Bot): void {
     if (!bot.channel) {
       throw new Error(`Bot "${bot.name}" does not have a registered channel`);
     }

     const botId = bot.id.value;

     // Set delay based on bot's typing delay setting
     this.setBotDelay(botId, bot.settings.queueDelay);

     // Set send callback that uses message channel
     this.setBotSendCallback(botId, async (botId: string, message: OutgoingMessage) => {
       await bot.channel!.send(message);
     });

     this.logger.info(`📋 Configured message queue for bot "${bot.name}": delay=${bot.settings.queueDelay}ms`);
   }

  /**
    * Add message to queue for a specific bot
    */
   enqueue(
     botId: string,
     to: string,
     content: string,
     metadata?: Record<string, any>
   ): string {
     const messageId = `${botId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

     const outgoingMessage = OutgoingMessage.create(to, content, metadata);

     const queuedMessage: QueuedMessage = {
       id: messageId,
       botId,
       message: outgoingMessage,
       timestamp: Date.now()
     };

     // Get or create queue for this bot
     if (!this.queues.has(botId)) {
       this.queues.set(botId, []);
     }

     const botQueue = this.queues.get(botId)!;

     // Add to end of queue (FIFO)
     botQueue.push(queuedMessage);

     this.logger.info(`📨 Message queued for bot "${botId}": ${messageId} (queue size: ${botQueue.length})`);

     // Start processing if not already running
     if (!this.processing.get(botId)) {
       this.startProcessing(botId);
     }

     return messageId;
   }

  /**
   * Start processing queue for a specific bot
   */
  private async startProcessing(botId: string): Promise<void> {
    if (this.processing.get(botId)) {
      return;
    }

    this.processing.set(botId, true);
    this.logger.info(`▶️  Started processing queue for bot "${botId}"`);

    const botQueue = this.queues.get(botId);
    if (!botQueue) {
      this.processing.set(botId, false);
      return;
    }

    while (botQueue.length > 0) {
      const messageData = botQueue.shift()!;
      const delay = this.delays.get(botId) || 2000; // Default 2 seconds

      try {
        // Wait before sending (simulate human-like delay)
        this.logger.debug(`⏳ Waiting ${delay}ms before sending message ${messageData.id} from bot "${botId}"...`);
        await this.delay(delay);

        this.logger.info(`📤 Processing queued message: ${messageData.id} from bot "${botId}"`);

        // Send message using callback
        const callback = this.sendCallbacks.get(botId);
        if (callback) {
          await callback(botId, messageData.message);
          this.logger.info(`✅ Queued message sent successfully: ${messageData.id}`);
        } else {
          this.logger.error(`❌ No send callback configured for bot "${botId}"`);
        }

      } catch (error) {
        this.logger.error(`❌ Error sending queued message ${messageData.id} from bot "${botId}":`, error);
        // Could implement retry logic here
      }
    }

    this.processing.set(botId, false);
    this.logger.info(`⏸️  Queue processing completed for bot "${botId}"`);
  }

  /**
   * Get queue status for a specific bot
   */
  getBotQueueStatus(botId: string): any {
    const queue = this.queues.get(botId) || [];
    const isProcessing = this.processing.get(botId) || false;
    const delay = this.delays.get(botId) || 2000;

    return {
      botId,
      queueSize: queue.length,
      isProcessing,
      delayMs: delay,
      hasCallback: this.sendCallbacks.has(botId),
      nextMessage: queue.length > 0 ? {
        id: queue[0].id,
        to: queue[0].message.getTo(),
        age: Date.now() - queue[0].timestamp
      } : null
    };
  }

  /**
   * Clear queue for a specific bot
   */
  clearBotQueue(botId: string): void {
    this.queues.delete(botId);
    this.logger.info(`🗑️  Queue cleared for bot "${botId}"`);
  }

  /**
   * Get status of all queues
   */
  getAllQueuesStatus(): any {
    const allStatuses: any[] = [];

    for (const [botId, queue] of this.queues.entries()) {
      const status = this.getBotQueueStatus(botId);
      allStatuses.push(status);
    }

    return {
      totalQueues: allStatuses.length,
      queues: allStatuses
    };
  }

  /**
   * Shutdown all queues and stop processing
   */
  async shutdown(): Promise<void> {
    this.logger.info('🛑 Shutting down message queue service...');

    // Stop all processing
    for (const [botId] of this.processing.entries()) {
      this.processing.set(botId, false);
    }

    // Clear all queues
    this.queues.clear();
    this.delays.clear();
    this.sendCallbacks.clear();

    this.logger.info('✅ Message queue service shut down');
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
