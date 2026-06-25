import { OutboxService } from '../../../src/messages/outbox'
import { Bot, createBot, createDefaultSettings } from '../../../src/bot'
import { MockChannel } from '../helpers/mock-channel'

jest.useFakeTimers()

describe('OutboxService', () => {
  let outbox: OutboxService
  let mockChannel: MockChannel
  let bot: Bot
  let sentMessages: string[]

  beforeEach(() => {
    outbox = new OutboxService()
    mockChannel = new MockChannel()
    sentMessages = []
    bot = createBot({ id: 'test-bot', settings: createDefaultSettings() })
    bot.channel = mockChannel
  })

  afterEach(async () => {
    await outbox.shutdown()
    jest.runAllTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  describe('setBotDelay', () => {
    it('should set delay for bot', () => {
      outbox.setBotDelay('test-bot', 500)
    })
  })

  describe('setBotSendCallback', () => {
    it('should store send callback', () => {
      const cb = jest.fn()
      outbox.setBotSendCallback('test-bot', cb)
    })
  })

  describe('setupBotQueue', () => {
    it('should configure queue for a bot', () => {
      outbox.setupBotQueue(bot)
    })
  })

  describe('enqueue', () => {
    it('should return a message id', () => {
      const id = outbox.enqueue('test-bot', '521234567890', 'Hello!')
      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
      expect(id).toContain('test-bot')
    })

    it('should start processing on enqueue', () => {
      outbox.setupBotQueue(bot)
      outbox.enqueue('test-bot', '521234567890', 'Hello!')

      const status = outbox.getBotQueueStatus('test-bot')
      expect(status.isProcessing).toBe(true)
    })
  })

  describe('getBotQueueStatus', () => {
    it('should return status with defaults for unknown bot', () => {
      const status = outbox.getBotQueueStatus('unknown')
      expect(status.queueSize).toBe(0)
      expect(status.isProcessing).toBe(false)
      expect(status.delayMs).toBe(2000)
      expect(status.hasCallback).toBe(false)
      expect(status.nextMessage).toBeNull()
    })

    it('should show processing after enqueue', () => {
      outbox.enqueue('test-bot', '521234567890', 'Hello!')

      const status = outbox.getBotQueueStatus('test-bot')
      expect(status.isProcessing).toBe(true)
    })
  })

  describe('clearBotQueue', () => {
    it('should clear queue for bot', () => {
      outbox.enqueue('test-bot', '521234567890', 'Hello!')
      outbox.clearBotQueue('test-bot')

      const status = outbox.getBotQueueStatus('test-bot')
      expect(status.queueSize).toBe(0)
    })
  })

  describe('getAllQueuesStatus', () => {
    it('should return empty status when no queues', () => {
      const all = outbox.getAllQueuesStatus()
      expect(all.totalQueues).toBe(0)
      expect(all.queues).toEqual([])
    })
  })

  describe('shutdown', () => {
    it('should clear all queues and callbacks', async () => {
      outbox.setupBotQueue(bot)
      outbox.enqueue('test-bot', '521234567890', 'Hello!')

      await outbox.shutdown()

      const all = outbox.getAllQueuesStatus()
      expect(all.totalQueues).toBe(0)
    })
  })

  describe('processing', () => {
    it('should process queued messages with callback', async () => {
      outbox.setBotSendCallback('test-bot', async (_botId: string, msg) => {
        sentMessages.push(msg.content)
      })
      outbox.enqueue('test-bot', '521234567890', 'Hello!')

      jest.advanceTimersByTime(2000)
      await Promise.resolve()

      expect(sentMessages).toContain('Hello!')
    })

    it('should handle missing callback gracefully', async () => {
      outbox.enqueue('test-bot', '521234567890', 'Hello!')

      jest.advanceTimersByTime(2000)
      await Promise.resolve()
    })
  })
})
