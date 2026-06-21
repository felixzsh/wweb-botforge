import { createBot, createDefaultSettings, registerChannel } from '../../src/bot/bot'
import { BotSettings, MessageChannel } from '../../src/bot/types'

describe('Bot', () => {
  let settings: BotSettings

  beforeEach(() => {
    settings = createDefaultSettings()
  })

  describe('createBot', () => {
    it('should create a Bot with all properties', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        phone: '1234567890',
        settings,
      })

      expect(bot.id).toBe('test-bot')
      expect(bot.name).toBe('Test Bot')
      expect(bot.phone).toBe('1234567890')
      expect(bot.settings).toBe(settings)
    })

    it('should create a Bot without phone', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
      })

      expect(bot.phone).toBeUndefined()
    })

    it('should create a Bot with flows', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
        flows: [{ id: 'faq-menu', priority: 1 }],
      })

      expect(bot.flows).toHaveLength(1)
      expect(bot.flows[0].id).toBe('faq-menu')
    })

    it('should throw error if name is empty', () => {
      expect(() =>
        createBot({
          id: 'test-bot',
          name: '',
          settings,
        })
      ).toThrow('Bot name cannot be empty')
    })

    it('should throw error if name is only whitespace', () => {
      expect(() =>
        createBot({
          id: 'test-bot',
          name: '   ',
          settings,
        })
      ).toThrow('Bot name cannot be empty')
    })

    it('should throw error for invalid bot ID', () => {
      expect(() =>
        createBot({
          id: 'ab',
          name: 'Test Bot',
          settings,
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

  describe('registerChannel', () => {
    it('should register a channel to the bot', () => {
      const bot = createBot({
        id: 'test-bot',
        name: 'Test Bot',
        settings,
      })

      const mockChannel: MessageChannel = {
        send: jest.fn().mockResolvedValue('msg-id'),
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
