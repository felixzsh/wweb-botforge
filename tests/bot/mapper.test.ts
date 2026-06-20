import { mapConfigToBot, mapSettings, mapAutoResponse, mapWebhook, mapBotsFromConfig } from '../../src/bot/mapper'
import { BotConfig, BotSettingsConfig } from '../../src/bot/types'

describe('Mapper', () => {
  describe('mapSettings', () => {
    it('should map settings with default values', () => {
      const config: BotSettingsConfig = {}
      const settings = mapSettings(config)

      expect(settings.simulateTyping).toBe(true)
      expect(settings.typingDelay).toBe(1000)
      expect(settings.queueDelay).toBe(1000)
      expect(settings.readReceipts).toBe(true)
      expect(settings.ignoreGroups).toBe(true)
      expect(settings.ignoredSenders).toEqual([])
      expect(settings.adminNumbers).toEqual([])
    })

    it('should map settings with custom values', () => {
      const config: BotSettingsConfig = {
        simulate_typing: false,
        typing_delay: 500,
        queue_delay: 2000,
        read_receipts: false,
        ignore_groups: false,
        ignored_senders: ['1111111111', '2222222222'],
        admin_numbers: ['9999999999'],
      }

      const settings = mapSettings(config)

      expect(settings.simulateTyping).toBe(false)
      expect(settings.typingDelay).toBe(500)
      expect(settings.queueDelay).toBe(2000)
      expect(settings.readReceipts).toBe(false)
      expect(settings.ignoreGroups).toBe(false)
      expect(settings.ignoredSenders).toEqual(['1111111111', '2222222222'])
      expect(settings.adminNumbers).toEqual(['9999999999'])
    })
  })

  describe('mapAutoResponse', () => {
    it('should map auto-response with default values', () => {
      const config = {
        pattern: 'hello',
        response: 'Hi there!',
      }

      const autoResponse = mapAutoResponse(config)

      expect(autoResponse.patternString).toBe('hello')
      expect(autoResponse.fuzzySegments).toEqual(['hello'])
      expect(autoResponse.response).toBe('Hi there!')
      expect(autoResponse.priority).toBe(1)
      expect(autoResponse.cooldown).toBeUndefined()
      expect(autoResponse.fuzzyThreshold).toBe(0.6)
    })

    it('should map auto-response with custom values', () => {
      const config = {
        pattern: 'help, assist, support',
        response: 'How can I help?',
        priority: 5,
        cooldown: 60,
        case_insensitive: true,
        fuzzy_threshold: 0.3,
        response_options: { linkPreview: false },
      }

      const autoResponse = mapAutoResponse(config)

      expect(autoResponse.priority).toBe(5)
      expect(autoResponse.cooldown).toBe(60)
      expect(autoResponse.fuzzySegments).toEqual(['help', 'assist', 'support'])
      expect(autoResponse.fuzzyThreshold).toBe(0.3)
      expect(autoResponse.responseOptions).toEqual({ linkPreview: false })
    })

    it('should split pattern by comma into fuzzy segments', () => {
      const config = {
        pattern: 'hola, buenos dias, hey',
        response: 'Saludos!',
      }

      const autoResponse = mapAutoResponse(config)

      expect(autoResponse.fuzzySegments).toEqual(['hola', 'buenos dias', 'hey'])
      expect(autoResponse.patternString).toBe('hola, buenos dias, hey')
    })

    it('should throw error for empty pattern', () => {
      const config = {
        pattern: '   ,   ',
        response: 'Response',
      }

      expect(() => mapAutoResponse(config)).toThrow('Auto-response pattern must contain at least one phrase')
    })
  })

  describe('mapWebhook', () => {
    it('should map webhook with default values', () => {
      const config = {
        name: 'test-webhook',
        pattern: 'order, pedido',
        url: 'https://api.example.com/orders',
      }

      const webhook = mapWebhook(config)

      expect(webhook.name).toBe('test-webhook')
      expect(webhook.patternString).toBe('order, pedido')
      expect(webhook.fuzzySegments).toEqual(['order', 'pedido'])
      expect(webhook.url).toBe('https://api.example.com/orders')
      expect(webhook.method).toBe('POST')
      expect(webhook.timeout).toBe(5000)
      expect(webhook.retries).toBe(3)
      expect(webhook.priority).toBe(1)
      expect(webhook.fuzzyThreshold).toBe(0.6)
      expect(webhook.headers).toEqual({})
    })

    it('should map webhook with custom values', () => {
      const config = {
        name: 'custom-webhook',
        pattern: 'custom, personalized',
        url: 'https://api.example.com/custom',
        method: 'PUT' as const,
        timeout: 10000,
        retry: 5,
        fuzzy_threshold: 0.3,
        priority: 2,
        cooldown: 120,
        headers: {
          Authorization: 'Bearer token123',
          'X-Custom-Header': 'value',
        },
      }

      const webhook = mapWebhook(config)

      expect(webhook.method).toBe('PUT')
      expect(webhook.timeout).toBe(10000)
      expect(webhook.retries).toBe(5)
      expect(webhook.priority).toBe(2)
      expect(webhook.fuzzyThreshold).toBe(0.3)
      expect(webhook.fuzzySegments).toEqual(['custom', 'personalized'])
      expect(webhook.cooldown).toBe(120)
      expect(webhook.headers['Authorization']).toBe('Bearer token123')
    })

    it('should split webhook pattern by comma', () => {
      const config = {
        name: 'test',
        pattern: 'order, purchase, buy',
        url: 'https://example.com',
      }

      const webhook = mapWebhook(config)

      expect(webhook.fuzzySegments).toEqual(['order', 'purchase', 'buy'])
      expect(webhook.patternString).toBe('order, purchase, buy')
    })
  })

  describe('mapConfigToBot', () => {
    it('should map minimal bot configuration', () => {
      const config: BotConfig = {
        id: 'test-bot',
        name: 'Test Bot',
      }

      const bot = mapConfigToBot(config)

      expect(bot.id).toBe('test-bot')
      expect(bot.name).toBe('Test Bot')
      expect(bot.phone).toBeUndefined()
      expect(bot.autoResponses).toHaveLength(0)
      expect(bot.webhooks).toHaveLength(0)
    })

    it('should map bot with phone number', () => {
      const config: BotConfig = {
        id: 'support-bot',
        name: 'Support Bot',
        phone: '1234567890',
      }

      const bot = mapConfigToBot(config)

      expect(bot.phone).toBe('1234567890')
    })

    it('should map complete bot configuration', () => {
      const config: BotConfig = {
        id: 'complete-bot',
        name: 'Complete Bot',
        phone: '1234567890',
        settings: {
          simulate_typing: true,
          typing_delay: 1500,
          queue_delay: 1000,
          read_receipts: true,
          ignore_groups: false,
          ignored_senders: ['spam@broadcast'],
          admin_numbers: ['9999999999'],
        },
        auto_responses: [
          {
            pattern: 'hello',
            response: 'Hello!',
            priority: 1,
            cooldown: 30,
          },
        ],
        webhooks: [
          {
            name: 'order-webhook',
            pattern: 'order',
            url: 'https://api.example.com/orders',
            method: 'POST',
            priority: 1,
          },
        ],
      }

      const bot = mapConfigToBot(config)

      expect(bot.id).toBe('complete-bot')
      expect(bot.name).toBe('Complete Bot')
      expect(bot.phone).toBe('1234567890')
      expect(bot.autoResponses).toHaveLength(1)
      expect(bot.webhooks).toHaveLength(1)
      expect(bot.settings.ignoreGroups).toBe(false)
    })

    it('should throw error for invalid bot ID', () => {
      const config: BotConfig = {
        id: 'ab',
        name: 'Test Bot',
      }

      expect(() => mapConfigToBot(config)).toThrow('Bot ID must be at least 3 characters long')
    })

    it('should throw error for empty bot name', () => {
      const config: BotConfig = {
        id: 'test-bot',
        name: '',
      }

      expect(() => mapConfigToBot(config)).toThrow('Bot name cannot be empty')
    })
  })

  describe('mapBotsFromConfig', () => {
    it('should map multiple bot configurations', () => {
      const configs: BotConfig[] = [
        { id: 'bot-1', name: 'Bot 1' },
        { id: 'bot-2', name: 'Bot 2' },
        { id: 'bot-3', name: 'Bot 3' },
      ]

      const bots = mapBotsFromConfig(configs)

      expect(bots).toHaveLength(3)
      expect(bots[0].id).toBe('bot-1')
      expect(bots[1].id).toBe('bot-2')
      expect(bots[2].id).toBe('bot-3')
    })

    it('should return empty array for empty input', () => {
      const bots = mapBotsFromConfig([])
      expect(bots).toHaveLength(0)
    })
  })
})
