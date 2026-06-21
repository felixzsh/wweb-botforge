import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { loadConfig } from '../../src/config/yaml'
import { mapConfigToBot } from '../../src/bot/mapper'
import { BotConfig } from '../../src/bot/types'

describe('YAML Configuration Loading Integration Tests', () => {
  describe('Valid Configuration Files', () => {
    describe('Minimal Bot Configuration', () => {
      it('should load minimal bot configuration successfully', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/minimal-bot.yml')

        const config = await loadConfig(fixturePath)

        expect(config).toBeDefined()
        expect(config.bots).toBeDefined()
        expect(Object.keys(config.bots)).toHaveLength(1)
        expect(config.bots['minimal-bot']).toBeDefined()
      })

      it('should map minimal bot to domain', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/minimal-bot.yml')

        const config = await loadConfig(fixturePath)
        const bot = mapConfigToBot('minimal-bot', config.bots['minimal-bot'])

        expect(bot).toBeDefined()
        expect(bot.id).toBe('minimal-bot')
        expect(bot.phone).toBeUndefined()
      })
    })

    describe('Configuration with Actions and Flows Directories', () => {
      let tempDir: string

      afterEach(() => {
        if (tempDir && fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true })
        }
      })

      it('should load actions and flows from adjacent directories', async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-config-'))

        const configPath = path.join(tempDir, 'config.yml')
        const actionsDir = path.join(tempDir, 'actions')
        const flowsDir = path.join(tempDir, 'flows')

        fs.mkdirSync(actionsDir)
        fs.mkdirSync(flowsDir)

        fs.writeFileSync(configPath, `
global:
  sessionTimeout: 120
bots:
  test-bot:
    flows:
      - id: faq-menu
`)

        fs.writeFileSync(path.join(actionsDir, 'greet.yml'), `
reply: "Hello! Choose an option"
`)

        fs.writeFileSync(path.join(flowsDir, 'faq-menu.yml'), `
entry_step: menu
triggers: "menu, hello"
steps:
  menu:
    action: greet
    branches: []
`)

        const config = await loadConfig(configPath)

        expect(config.actions).toBeDefined()
        expect(config.actions?.greet).toBeDefined()
        expect(config.actions?.greet.reply).toBe('Hello! Choose an option')

        expect(config.flows).toBeDefined()
        expect(config.flows?.['faq-menu']).toBeDefined()
        expect(config.flows?.['faq-menu'].entry_step).toBe('menu')
      })
    })
  })

  describe('Error Handling', () => {
    it('should throw error when bots object is missing', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/missing-bots.yml')

      await expect(loadConfig(fixturePath)).rejects.toThrow(
        'Configuration must contain a "bots" object'
      )
    })

    it('should throw error when bot ID is too short', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/invalid-bot-id.yml')

      const config = await loadConfig(fixturePath)
      const [id, botConfig] = Object.entries(config.bots)[0]

      expect(() => mapConfigToBot(id, botConfig)).toThrow(
        'Bot ID must be at least 3 characters long'
      )
    })

    it('should throw error when phone number format is invalid', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/invalid-phone.yml')

      const config = await loadConfig(fixturePath)
      const [id, botConfig] = Object.entries(config.bots)[0]

      expect(() => mapConfigToBot(id, botConfig)).toThrow(
        'Invalid phone number format'
      )
    })

    it('should throw error when typing delay is negative', () => {
      expect(() => mapConfigToBot('test-bot', <BotConfig>{
        settings: {
          typing_delay: -100,
        },
      })).toThrow('Typing delay must be non-negative')
    })

    it('should throw error when queue delay is negative', () => {
      expect(() => mapConfigToBot('test-bot', <BotConfig>{
        settings: {
          queue_delay: -500,
        },
      })).toThrow('Queue delay must be non-negative')
    })
  })

  describe('Configuration Variants', () => {
    it('should handle configuration with default settings when not provided', () => {
      const bot = mapConfigToBot('test-bot', {})

      expect(bot.settings.simulateTyping).toBe(true)
      expect(bot.settings.typingDelay).toBe(1000)
      expect(bot.settings.queueDelay).toBe(1000)
      expect(bot.settings.readReceipts).toBe(true)
      expect(bot.settings.ignoreGroups).toBe(true)
    })

    it('should handle configuration with custom settings', () => {
      const bot = mapConfigToBot('test-bot', <BotConfig>{
        settings: {
          simulate_typing: false,
          typing_delay: 500,
          queue_delay: 2000,
          read_receipts: false,
          ignore_groups: false,
          ignored_senders: ['1234567890', '0987654321'],
          admin_numbers: ['1111111111'],
        },
      })

      expect(bot.settings.simulateTyping).toBe(false)
      expect(bot.settings.typingDelay).toBe(500)
      expect(bot.settings.queueDelay).toBe(2000)
      expect(bot.settings.readReceipts).toBe(false)
      expect(bot.settings.ignoreGroups).toBe(false)
      expect(bot.settings.ignoredSenders).toEqual(['1234567890', '0987654321'])
      expect(bot.settings.adminNumbers).toEqual(['1111111111'])
    })
  })
})
