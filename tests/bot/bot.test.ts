import { createBot, createDefaultSettings, findMatchingAutoResponse, findMatchingWebhook, findMatchingWebhooks, registerChannel } from '../../src/bot/bot'
import { Bot, BotSettings, AutoResponse, Webhook, MessageChannel } from '../../src/bot/types'

describe('Bot', () => {
  let settings: BotSettings
  let autoResponses: AutoResponse[]
  let webhooks: Webhook[]

  beforeEach(() => {
    settings = createDefaultSettings()

    autoResponses = [
      {
        pattern: new RegExp('hello', 'i'),
        patternString: 'hello',
        response: 'Hi there!',
        priority: 1,
        cooldown: 30,
      },
      {
        pattern: new RegExp('bye', 'i'),
        patternString: 'bye',
        response: 'Goodbye!',
        priority: 2,
        cooldown: 0,
      },
    ]

    webhooks = [
      {
        name: 'greeting-webhook',
        pattern: new RegExp('hello', 'i'),
        patternString: 'hello',
        url: 'https://example.com/webhook',
        method: 'POST',
        headers: {},
        timeout: 5000,
        retries: 3,
        priority: 1,
        cooldown: 60,
      },
      {
        name: 'farewell-webhook',
        pattern: new RegExp('bye', 'i'),
        patternString: 'bye',
        url: 'https://example.com/farewell',
        method: 'POST',
        headers: {},
        timeout: 5000,
        retries: 3,
        priority: 2,
      },
    ]
  })

  describe('createBot', () => {
    it('should create a Bot with all properties', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        phone: '1234567890',
        settings,
        autoResponses,
        webhooks,
      })

      expect(bot.id).toBe('test-bot')
      expect(bot.name).toBe('Test Bot')
      expect(bot.phone).toBe('1234567890')
      expect(bot.settings).toBe(settings)
      expect(bot.autoResponses).toEqual(autoResponses)
      expect(bot.webhooks).toEqual(webhooks)
    })

    it('should create a Bot without phone', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        autoResponses,
        webhooks,
      })

      expect(bot.phone).toBeUndefined()
    })

    it('should throw error if name is empty', () => {
      expect(() =>
        createBot({
          id: 'test-bot',
          name: '',
          settings,
          autoResponses,
          webhooks,
        })
      ).toThrow('Bot name cannot be empty')
    })

    it('should throw error if name is only whitespace', () => {
      expect(() =>
        createBot({
          id: 'test-bot',
          name: '   ',
          settings,
          autoResponses,
          webhooks,
        })
      ).toThrow('Bot name cannot be empty')
    })

    it('should throw error for invalid bot ID', () => {
      expect(() =>
        createBot({
          id: 'ab',
          name: 'Test Bot',
          settings,
          autoResponses,
          webhooks,
        })
      ).toThrow('Bot ID must be at least 3 characters long')
    })
  })

  describe('createDefaultSettings', () => {
    it('should create default settings', () => {
      const defaultSettings = createDefaultSettings()

      expect(defaultSettings.simulateTyping).toBe(true)
      expect(defaultSettings.typingDelay).toBe(1000)
      expect(defaultSettings.queueDelay).toBe(1000)
      expect(defaultSettings.readReceipts).toBe(true)
      expect(defaultSettings.ignoreGroups).toBe(true)
      expect(defaultSettings.ignoredSenders).toEqual([])
      expect(defaultSettings.adminNumbers).toEqual([])
    })
  })

  describe('findMatchingAutoResponse', () => {
    it('should find matching auto-response by pattern', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        autoResponses,
        webhooks: [],
      })

      const response = findMatchingAutoResponse(bot, 'hello world')
      expect(response).toBe(autoResponses[0])
      expect(response?.response).toBe('Hi there!')
    })

    it('should return null if no pattern matches', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        autoResponses,
        webhooks: [],
      })

      const response = findMatchingAutoResponse(bot, 'unknown message')
      expect(response).toBeNull()
    })

    it('should prioritize higher priority responses', () => {
      const highPriority: AutoResponse = {
        pattern: new RegExp('test', 'i'),
        patternString: 'test',
        response: 'High priority',
        priority: 10,
      }

      const lowPriority: AutoResponse = {
        pattern: new RegExp('test', 'i'),
        patternString: 'test',
        response: 'Low priority',
        priority: 1,
      }

      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        autoResponses: [lowPriority, highPriority],
        webhooks: [],
      })

      const response = findMatchingAutoResponse(bot, 'test')
      expect(response).toBe(highPriority)
    })

    it('should handle case-insensitive matching', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        autoResponses,
        webhooks: [],
      })

      const response = findMatchingAutoResponse(bot, 'HELLO WORLD')
      expect(response).toBe(autoResponses[0])
    })
  })

  describe('findMatchingWebhook', () => {
    it('should find matching webhook by pattern', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks,
      })

      const webhook = findMatchingWebhook(bot, 'hello world')
      expect(webhook).toBe(webhooks[0])
      expect(webhook?.name).toBe('greeting-webhook')
    })

    it('should return null if no webhook matches', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks,
      })

      const webhook = findMatchingWebhook(bot, 'unknown message')
      expect(webhook).toBeNull()
    })

    it('should prioritize higher priority webhooks', () => {
      const highPriority: Webhook = {
        name: 'high-priority',
        pattern: new RegExp('test', 'i'),
        patternString: 'test',
        url: 'https://example.com/high',
        method: 'POST',
        headers: {},
        timeout: 5000,
        retries: 3,
        priority: 10,
      }

      const lowPriority: Webhook = {
        name: 'low-priority',
        pattern: new RegExp('test', 'i'),
        patternString: 'test',
        url: 'https://example.com/low',
        method: 'POST',
        headers: {},
        timeout: 5000,
        retries: 3,
        priority: 1,
      }

      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks: [lowPriority, highPriority],
      })

      const webhook = findMatchingWebhook(bot, 'test')
      expect(webhook).toBe(highPriority)
    })
  })

  describe('findMatchingWebhooks', () => {
    it('should find all matching webhooks', () => {
      const webhook1: Webhook = {
        name: 'webhook1',
        pattern: new RegExp('test', 'i'),
        patternString: 'test',
        url: 'https://example.com/1',
        method: 'POST',
        headers: {},
        timeout: 5000,
        retries: 3,
        priority: 1,
      }

      const webhook2: Webhook = {
        name: 'webhook2',
        pattern: new RegExp('test', 'i'),
        patternString: 'test',
        url: 'https://example.com/2',
        method: 'POST',
        headers: {},
        timeout: 5000,
        retries: 3,
        priority: 2,
      }

      const webhook3: Webhook = {
        name: 'webhook3',
        pattern: new RegExp('other', 'i'),
        patternString: 'other',
        url: 'https://example.com/3',
        method: 'POST',
        headers: {},
        timeout: 5000,
        retries: 3,
        priority: 1,
      }

      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks: [webhook1, webhook2, webhook3],
      })

      const matchingWebhooks = findMatchingWebhooks(bot, 'test')
      expect(matchingWebhooks).toHaveLength(2)
      expect(matchingWebhooks[0]).toBe(webhook2)
      expect(matchingWebhooks[1]).toBe(webhook1)
    })

    it('should return empty array if no webhooks match', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks,
      })

      const matchingWebhooks = findMatchingWebhooks(bot, 'unknown')
      expect(matchingWebhooks).toEqual([])
    })

    it('should sort webhooks by priority descending', () => {
      const webhook1: Webhook = {
        name: 'webhook1',
        pattern: new RegExp('test', 'i'),
        patternString: 'test',
        url: 'https://example.com/1',
        method: 'POST',
        headers: {},
        timeout: 5000,
        retries: 3,
        priority: 1,
      }

      const webhook2: Webhook = {
        name: 'webhook2',
        pattern: new RegExp('test', 'i'),
        patternString: 'test',
        url: 'https://example.com/2',
        method: 'POST',
        headers: {},
        timeout: 5000,
        retries: 3,
        priority: 5,
      }

      const webhook3: Webhook = {
        name: 'webhook3',
        pattern: new RegExp('test', 'i'),
        patternString: 'test',
        url: 'https://example.com/3',
        method: 'POST',
        headers: {},
        timeout: 5000,
        retries: 3,
        priority: 3,
      }

      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks: [webhook1, webhook2, webhook3],
      })

      const matchingWebhooks = findMatchingWebhooks(bot, 'test')
      expect(matchingWebhooks[0]).toBe(webhook2)
      expect(matchingWebhooks[1]).toBe(webhook3)
      expect(matchingWebhooks[2]).toBe(webhook1)
    })
  })

  describe('registerChannel', () => {
    it('should register a channel to the bot', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks: [],
      })

      const mockChannel: MessageChannel = {
        send: jest.fn(),
        onMessage: jest.fn(),
        onReady: jest.fn(),
        onDisconnected: jest.fn(),
        onAuthFailure: jest.fn(),
        onConnectionError: jest.fn(),
        onStateChange: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
      }

      registerChannel(bot, mockChannel)
      expect(bot.channel).toBe(mockChannel)
    })
  })
})
