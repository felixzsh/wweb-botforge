import { mapConfigToBot, mapSettings, mapBotsFromConfig } from '../../src/bot/mapper'
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

    it('should map bot with flows', () => {
      const config: BotConfig = {
        id: 'flow-bot',
        name: 'Flow Bot',
        flows: [{ id: 'faq-menu', priority: 5 }],
      }

      const bot = mapConfigToBot(config)

      expect(bot.flows).toHaveLength(1)
      expect(bot.flows[0].id).toBe('faq-menu')
      expect(bot.flows[0].priority).toBe(5)
    })

    it('should map complete bot configuration', () => {
      const config: BotConfig = {
        id: 'complete-bot',
        name: 'Complete Bot',
        phone: '1234567890',
        flows: [{ id: 'faq-menu', priority: 10 }],
        settings: {
          simulate_typing: true,
          typing_delay: 1500,
          queue_delay: 1000,
          read_receipts: true,
          ignore_groups: false,
          ignored_senders: ['spam@broadcast'],
          admin_numbers: ['9999999999'],
        },
      }

      const bot = mapConfigToBot(config)

      expect(bot.id).toBe('complete-bot')
      expect(bot.name).toBe('Complete Bot')
      expect(bot.phone).toBe('1234567890')
      expect(bot.flows).toHaveLength(1)
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
