import * as path from 'path'
import { loadConfig } from '../../src/config/yaml'
import { mapConfigToBot } from '../../src/bot/mapper'
import { ConfigFile, BotConfig } from '../../src/bot/types'

describe('YAML Configuration Loading Integration Tests', () => {
  describe('Valid Configuration Files', () => {
    describe('Minimal Bot Configuration', () => {
      it('should load minimal bot configuration successfully', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/minimal-bot.yml')

        const config = await loadConfig(fixturePath)

        expect(config).toBeDefined()
        expect(config.bots).toBeDefined()
        expect(config.bots).toHaveLength(1)
        expect(config.bots[0].id).toBe('minimal-bot')
        expect(config.bots[0].name).toBe('Minimal Bot')
      })

      it('should map minimal bot to domain', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/minimal-bot.yml')

        const config = await loadConfig(fixturePath)
        const bot = mapConfigToBot(config.bots[0])

        expect(bot).toBeDefined()
        expect(bot.id).toBe('minimal-bot')
        expect(bot.name).toBe('Minimal Bot')
        expect(bot.autoResponses).toHaveLength(0)
        expect(bot.webhooks).toHaveLength(0)
        expect(bot.phone).toBeUndefined()
      })
    })

    describe('Single File Configuration (main-single.yml)', () => {
      it('should load main-single.yml with multiple bots', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main-single.yml')

        const config = await loadConfig(fixturePath)

        expect(config).toBeDefined()
        expect(config.bots).toHaveLength(2)
      })

      it('should load soporte-bot correctly from main-single.yml', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main-single.yml')

        const config = await loadConfig(fixturePath)
        const soporteBotConfig = config.bots.find(b => b.id === 'soporte-bot')

        expect(soporteBotConfig).toBeDefined()
        expect(soporteBotConfig!.name).toBe('Bot de Soporte')
        expect(soporteBotConfig!.phone).toBe('521234567890')
        expect(soporteBotConfig!.auto_responses).toHaveLength(1)
        expect(soporteBotConfig!.webhooks).toHaveLength(2)
      })

      it('should map soporte-bot from main-single.yml to domain', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main-single.yml')

        const config = await loadConfig(fixturePath)
        const soporteBotConfig = config.bots.find(b => b.id === 'soporte-bot')!
        const bot = mapConfigToBot(soporteBotConfig)

        expect(bot.id).toBe('soporte-bot')
        expect(bot.name).toBe('Bot de Soporte')
        expect(bot.phone).toBe('521234567890')
        expect(bot.autoResponses).toHaveLength(1)
        expect(bot.webhooks).toHaveLength(2)
        expect(bot.settings.simulateTyping).toBe(true)
        expect(bot.settings.queueDelay).toBe(1000)
        expect(bot.settings.ignoreGroups).toBe(true)
      })
    })

    describe('Configuration with Includes (main.yml)', () => {
      it('should load main.yml with includes successfully', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main.yml')

        const config = await loadConfig(fixturePath)

        expect(config).toBeDefined()
        expect(config.bots).toHaveLength(2)
      })

      it('should load soporte-bot from includes correctly', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main.yml')

        const config = await loadConfig(fixturePath)
        const soporteBotConfig = config.bots.find(b => b.id === 'soporte-bot')

        expect(soporteBotConfig).toBeDefined()
        expect(soporteBotConfig!.name).toBe('Bot de Soporte')
        expect(soporteBotConfig!.phone).toBe('521234567890')
        expect(soporteBotConfig!.auto_responses!.length).toBeGreaterThanOrEqual(1)
        expect(soporteBotConfig!.webhooks).toHaveLength(2)
      })
    })

    describe('Complete Configuration with Global Settings', () => {
      it('should load complete configuration from main-complete.yml', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main-complete.yml')

        const config = await loadConfig(fixturePath)

        expect(config.global).toBeDefined()
        expect(config.global?.chromiumPath).toBe('/usr/bin/chromium')
        expect(config.global?.apiPort).toBe(3000)
        expect(config.global?.apiEnabled).toBe(true)
        expect(config.global?.logLevel).toBe('info')
        expect(config.bots).toHaveLength(2)
      })
    })
  })

  describe('Error Handling', () => {
    it('should throw error when bots array is missing', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/missing-bots.yml')

      await expect(loadConfig(fixturePath)).rejects.toThrow(
        'Configuration must contain a "bots" array'
      )
    })

    it('should throw error when bot ID is too short', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/invalid-bot-id.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapConfigToBot(config.bots[0])).toThrow(
        'Bot ID must be at least 3 characters long'
      )
    })

    it('should throw error when bot name is missing', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/bot-missing-name.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapConfigToBot(config.bots[0])).toThrow()
    })

    it('should throw error when phone number format is invalid', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/invalid-phone.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapConfigToBot(config.bots[0])).toThrow(
        'Invalid phone number format'
      )
    })

    it('should throw error when auto-response pattern is empty', () => {
      const invalidConfig: BotConfig = {
        id: 'test-bot',
        name: 'Test Bot',
        auto_responses: [
          {
            pattern: '   , ',
            response: 'Test response',
            priority: 1,
          },
        ],
      }

      expect(() => mapConfigToBot(invalidConfig)).toThrow(
        'Auto-response pattern must contain at least one phrase'
      )
    })

    it('should throw error when typing delay is negative', () => {
      const invalidConfig: BotConfig = {
        id: 'test-bot',
        name: 'Test Bot',
        settings: {
          typing_delay: -100,
        },
      }

      expect(() => mapConfigToBot(invalidConfig)).toThrow(
        'Typing delay must be non-negative'
      )
    })

    it('should throw error when queue delay is negative', () => {
      const invalidConfig: BotConfig = {
        id: 'test-bot',
        name: 'Test Bot',
        settings: {
          queue_delay: -500,
        },
      }

      expect(() => mapConfigToBot(invalidConfig)).toThrow(
        'Queue delay must be non-negative'
      )
    })

    it('should throw error when auto-response is missing response text', () => {
      const invalidConfig: BotConfig = {
        id: 'test-bot',
        name: 'Test Bot',
        auto_responses: [
          {
            pattern: 'hello',
            response: '',
            priority: 1,
          },
        ],
      }

      expect(() => mapConfigToBot(invalidConfig)).toThrow(
        'Response cannot be empty'
      )
    })

    it('should throw error when webhook name is empty', () => {
      const invalidConfig: BotConfig = {
        id: 'test-bot',
        name: 'Test Bot',
        webhooks: [
          {
            name: '',
            pattern: 'test',
            url: 'http://example.com',
            method: 'POST',
          },
        ],
      }

      expect(() => mapConfigToBot(invalidConfig)).toThrow(
        'Webhook name cannot be empty'
      )
    })

    it('should throw error when webhook URL is empty', () => {
      const invalidConfig: BotConfig = {
        id: 'test-bot',
        name: 'Test Bot',
        webhooks: [
          {
            name: 'test-webhook',
            pattern: 'test',
            url: '',
            method: 'POST',
          },
        ],
      }

      expect(() => mapConfigToBot(invalidConfig)).toThrow(
        'Webhook URL cannot be empty'
      )
    })
  })

  describe('Configuration Variants', () => {
    it('should handle configuration with default settings when not provided', () => {
      const config: BotConfig = {
        id: 'test-bot',
        name: 'Test Bot',
      }

      const bot = mapConfigToBot(config)

      expect(bot.settings.simulateTyping).toBe(true)
      expect(bot.settings.typingDelay).toBe(1000)
      expect(bot.settings.queueDelay).toBe(1000)
      expect(bot.settings.readReceipts).toBe(true)
      expect(bot.settings.ignoreGroups).toBe(true)
    })

    it('should handle configuration with custom settings', () => {
      const config: BotConfig = {
        id: 'test-bot',
        name: 'Test Bot',
        settings: {
          simulate_typing: false,
          typing_delay: 500,
          queue_delay: 2000,
          read_receipts: false,
          ignore_groups: false,
          ignored_senders: ['1234567890', '0987654321'],
          admin_numbers: ['1111111111'],
        },
      }

      const bot = mapConfigToBot(config)

      expect(bot.settings.simulateTyping).toBe(false)
      expect(bot.settings.typingDelay).toBe(500)
      expect(bot.settings.queueDelay).toBe(2000)
      expect(bot.settings.readReceipts).toBe(false)
      expect(bot.settings.ignoreGroups).toBe(false)
      expect(bot.settings.ignoredSenders).toEqual(['1234567890', '0987654321'])
      expect(bot.settings.adminNumbers).toEqual(['1111111111'])
    })

    it('should handle configuration with multiple auto-responses', () => {
      const config: BotConfig = {
        id: 'test-bot',
        name: 'Test Bot',
        auto_responses: [
          { pattern: 'hello', response: 'Hi!', priority: 1 },
          { pattern: 'bye', response: 'Goodbye!', priority: 2 },
          { pattern: 'help', response: 'How can I help?', priority: 3, cooldown: 60 },
        ],
      }

      const bot = mapConfigToBot(config)

      expect(bot.autoResponses).toHaveLength(3)
      expect(bot.autoResponses[0].response).toBe('Hi!')
      expect(bot.autoResponses[1].response).toBe('Goodbye!')
      expect(bot.autoResponses[2].response).toBe('How can I help?')
      expect(bot.autoResponses[2].cooldown).toBe(60)
    })

    it('should handle configuration with multiple webhooks', () => {
      const config: BotConfig = {
        id: 'test-bot',
        name: 'Test Bot',
        webhooks: [
          {
            name: 'webhook-1',
            pattern: 'order',
            url: 'http://api.example.com/orders',
            method: 'POST',
            priority: 1,
          },
          {
            name: 'webhook-2',
            pattern: 'support',
            url: 'http://api.example.com/support',
            method: 'POST',
            priority: 2,
            cooldown: 120,
          },
        ],
      }

      const bot = mapConfigToBot(config)

      expect(bot.webhooks).toHaveLength(2)
      expect(bot.webhooks[0].name).toBe('webhook-1')
      expect(bot.webhooks[1].name).toBe('webhook-2')
      expect(bot.webhooks[1].cooldown).toBe(120)
    })
  })
})
