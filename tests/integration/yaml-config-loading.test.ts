import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { loadConfig, saveConfig, addBotConfig, updateBotConfig, setConfigPath, getConfigPath } from '../../src/config/yaml'
import { mapConfigToBot, mapBotsFromConfig, mapSettings, mapActionCatalog, mapFlowCatalog } from '../../src/config/mapper'
import { BotConfig } from '../../src/config/schema'

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
      })
    })

    describe('Defaults Only Configuration', () => {
      it('should load config with pure defaults', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/defaults-only.yml')

        const config = await loadConfig(fixturePath)

        expect(config.bots['default-bot']).toBeDefined()
      })

      it('should apply all default settings', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/defaults-only.yml')

        const config = await loadConfig(fixturePath)
        const bot = mapConfigToBot('default-bot', config.bots['default-bot'])

        expect(bot.settings.simulateTyping).toBe(true)
        expect(bot.settings.typingDelay).toBe(1000)
        expect(bot.settings.queueDelay).toBe(1000)
        expect(bot.settings.readReceipts).toBe(true)
        expect(bot.settings.ignoreGroups).toBe(true)
        expect(bot.settings.ignoredSenders).toEqual([])
        expect(bot.settings.adminNumbers).toEqual([])
        expect(bot.flows).toEqual([])
      })
    })

    describe('Full Configuration', () => {
      it('should load full configuration with actions, flows and multiple bots', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/full-config.yml')

        const config = await loadConfig(fixturePath)

        expect(config.global?.sessionTimeout).toBe(300)
        expect(config.global?.logLevel).toBe('info')
        expect(config.actions).toBeDefined()
        expect(config.flows).toBeDefined()
        expect(Object.keys(config.bots)).toHaveLength(2)
      })

      it('should map all actions from full config', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/full-config.yml')

        const config = await loadConfig(fixturePath)
        const catalog = mapActionCatalog(config.actions!)

        expect(catalog.has('greet')).toBe(true)
        expect(catalog.has('escalate')).toBe(true)
        expect(catalog.has('lead-notify')).toBe(true)
        expect(catalog.has('pong')).toBe(true)

        const escalate = catalog.get('escalate')!
        expect(escalate.reply).toBe('Connecting you to a human agent.')
        expect(escalate.webhook?.name).toBe('escalate-human')
        expect(escalate.webhook?.method).toBe('POST')
        expect(escalate.webhook?.timeout).toBe(10000)
        expect(escalate.webhook?.retries).toBe(3)
        expect(escalate.cooldown).toBe(120)
        expect(escalate.cooldownReply).toBe('You already requested a human agent. Please wait.')

        const leadNotify = catalog.get('lead-notify')!
        expect(leadNotify.webhook?.url).toBe('https://crm.example.com/leads')
        expect(leadNotify.reply).toBeUndefined()
      })

      it('should map all flows from full config', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/full-config.yml')

        const config = await loadConfig(fixturePath)
        const catalog = mapFlowCatalog(config.flows!)

        expect(catalog.has('faq-support')).toBe(true)
        expect(catalog.has('ping-pong')).toBe(true)

        const faq = catalog.get('faq-support')!
        expect(faq.entryStep).toBe('menu')
        expect(faq.triggers?.[0].phrases).toEqual(['menu', 'hola', 'hello', 'help'])
        expect(faq.timeout).toBe(300)
        expect(faq.fallbackStep).toBe('invalid')
        expect(Object.keys(faq.steps)).toHaveLength(6)

        const menuStep = faq.steps.menu
        expect(menuStep.branches).toHaveLength(4)
        expect(menuStep.branches[0].when).toEqual(['1', 'hours', 'schedule'])
        expect(menuStep.branches[3].when).toBeUndefined()

        const pingPong = catalog.get('ping-pong')!
        expect(pingPong.steps.ping.branches).toHaveLength(0)
      })

      it('should map support bot with flow references', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/full-config.yml')

        const config = await loadConfig(fixturePath)
        const bot = mapConfigToBot('support-bot', config.bots['support-bot'])

        expect(bot.flows).toHaveLength(2)
        expect(bot.flows[0].id).toBe('faq-support')
        expect(bot.flows[0].priority).toBe(10)
        expect(bot.flows[1].id).toBe('ping-pong')
        expect(bot.flows[1].priority).toBe(5)
        expect(bot.settings.queueDelay).toBe(1500)
        expect(bot.settings.simulateTyping).toBe(true)
        expect(bot.settings.ignoredSenders).toEqual(['status@broadcast'])
        expect(bot.settings.adminNumbers).toEqual(['9999999999'])
      })

      it('should map sales bot with partial settings', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/full-config.yml')

        const config = await loadConfig(fixturePath)
        const bot = mapConfigToBot('sales-bot', config.bots['sales-bot'])

        expect(bot.flows).toHaveLength(1)
        expect(bot.settings.ignoreGroups).toBe(false)
        expect(bot.settings.ignoredSenders).toEqual([])
      })
    })

    describe('Structured Flow Triggers', () => {
      it('should parse structured trigger format', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/flow-structured-triggers.yml')

        const config = await loadConfig(fixturePath)
        const catalog = mapFlowCatalog(config.flows!)

        const flow = catalog.get('fancy-flow')!
        expect(flow.triggers).toHaveLength(1)
        expect(flow.triggers![0].phrases).toEqual(['hola', 'hello', 'hi'])
        expect(flow.triggers![0].fuzzyThreshold).toBe(0.4)
      })
    })
  })

  describe('Action Validation', () => {
    it('should throw when action has neither reply nor webhook', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/action-empty.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapActionCatalog(config.actions!)).toThrow(
        'Action "broken-action" must define reply, webhook, or both'
      )
    })

    it('should apply webhook defaults for minimal webhook action', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/action-webhook-minimal.yml')

      const config = await loadConfig(fixturePath)
      const catalog = mapActionCatalog(config.actions!)

      const action = catalog.get('notify')!
      expect(action.webhook?.url).toBe('https://example.com/hook')
      expect(action.webhook?.method).toBe('POST')
      expect(action.webhook?.timeout).toBe(5000)
      expect(action.webhook?.retries).toBe(3)
      expect(action.webhook?.headers).toEqual({})
    })
  })

  describe('Flow Validation', () => {
    it('should throw when entry step does not exist', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/flow-bad-entry.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapFlowCatalog(config.flows!)).toThrow(
        'Flow "broken-flow" entry step "nonexistent" not found'
      )
    })

    it('should throw when fallback step does not exist', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/flow-bad-fallback.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapFlowCatalog(config.flows!)).toThrow(
        'Flow "broken-flow" fallback step "nonexistent" not found'
      )
    })

    it('should throw when steps map is empty', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/flow-no-steps.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapFlowCatalog(config.flows!)).toThrow(
        'Flow "broken-flow" entry step "start" not found'
      )
    })
  })

  describe('Bot Validation', () => {
    it('should throw when flow priority is negative', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/bot-negative-priority.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapConfigToBot('bad-bot', config.bots['bad-bot'])).toThrow(
        'Priority must be non-negative'
      )
    })

    it('should throw when queue delay is negative', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/bot-negative-delay.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapConfigToBot('bad-bot', config.bots['bad-bot'])).toThrow(
        'Queue delay must be non-negative'
      )
    })
  })

  describe('Config Structure Errors', () => {
    it('should throw when bots is not an object', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/bots-not-object.yml')

      await expect(loadConfig(fixturePath)).rejects.toThrow(
        'Configuration must contain a "bots" object'
      )
    })

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
  })

  describe('Extra Fields Tolerance', () => {
    it('should ignore unknown fields at all levels', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/extra-fields.yml')

      const config = await loadConfig(fixturePath)

      expect(config.bots['tolerant-bot']).toBeDefined()

      const catalog = mapActionCatalog(config.actions!)
      expect(catalog.has('greet')).toBe(true)

      const flowCatalog = mapFlowCatalog(config.flows!)
      expect(flowCatalog.has('simple-flow')).toBe(true)

      const bot = mapConfigToBot('tolerant-bot', config.bots['tolerant-bot'])
      expect(bot.settings.simulateTyping).toBe(false)
    })
  })

  describe('Modular Configuration', () => {
    it('should load actions from adjacent actions/ directory', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/modular/config.yml')

      const config = await loadConfig(fixturePath)

      expect(config.actions?.greet).toBeDefined()
      expect(config.actions?.greet.reply).toBe('Hello! Welcome to our support chat. How can I help you?')
      expect(config.actions?.menu).toBeDefined()
      expect(config.actions?.hours).toBeDefined()
      expect(config.actions?.invalid).toBeDefined()
    })

    it('should load flows from adjacent flows/ directory', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/modular/config.yml')

      const config = await loadConfig(fixturePath)

      expect(config.flows?.faq).toBeDefined()
      expect(config.flows?.faq.entry_step).toBe('menu')
      expect(config.flows?.faq.triggers).toBe('menu, help, faq')
      expect(config.flows?.faq.fallback_step).toBe('invalid')
    })

    it('should load bots from adjacent bots/ directory', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/modular/config.yml')

      const config = await loadConfig(fixturePath)

      expect(config.bots['support-bot']).toBeDefined()
      expect(config.bots['sales-bot']).toBeDefined()
      expect(config.bots['support-bot'].flows).toHaveLength(1)
      expect(config.bots['support-bot'].flows![0].id).toBe('faq')
      expect(config.bots['support-bot'].flows![0].priority).toBe(10)
    })

    it('should map bots loaded from directory', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/modular/config.yml')

      const config = await loadConfig(fixturePath)
      const bots = mapBotsFromConfig(config.bots)

      expect(bots).toHaveLength(2)
      const supportBot = bots.find(b => b.id === 'support-bot')!
      expect(supportBot.settings.queueDelay).toBe(1500)
      expect(supportBot.settings.ignoreGroups).toBe(true)

      const salesBot = bots.find(b => b.id === 'sales-bot')!
      expect(salesBot.settings.queueDelay).toBe(1000)
      expect(salesBot.settings.ignoreGroups).toBe(false)
    })
  })

  describe('Inline Override of Directory Definitions', () => {
    let tempDir: string

    afterEach(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('should let inline bot override directory bot with same id', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-config-'))

      const configPath = path.join(tempDir, 'config.yml')
      const botsDir = path.join(tempDir, 'bots')
      fs.mkdirSync(botsDir)

      fs.writeFileSync(configPath, `
global:
  sessionTimeout: 600
bots:
  support-bot:
    flows:
      - id: faq
        priority: 99
    settings:
      queue_delay: 9999
`)

      fs.writeFileSync(path.join(botsDir, 'support-bot.yml'), `
flows:
  - id: faq
    priority: 1
settings:
  queue_delay: 500
`)

      const config = await loadConfig(configPath)

      expect(Object.keys(config.bots)).toHaveLength(1)
      const bot = mapConfigToBot('support-bot', config.bots['support-bot'])
      expect(bot.flows[0].priority).toBe(99)
      expect(bot.settings.queueDelay).toBe(9999)
    })

    it('should let inline action override directory action with same id', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-config-'))

      const configPath = path.join(tempDir, 'config.yml')
      const actionsDir = path.join(tempDir, 'actions')
      fs.mkdirSync(actionsDir)

      fs.writeFileSync(configPath, `
bots:
  test-bot:
    flows:
      - id: test-flow
actions:
  greet:
    reply: "Overridden reply"
flows:
  test-flow:
    entry_step: start
    steps:
      start:
        action: greet
        branches: []
`)

      fs.writeFileSync(path.join(actionsDir, 'greet.yml'), `
reply: "Original reply from directory"
`)

      const config = await loadConfig(configPath)
      expect(config.actions?.greet.reply).toBe('Overridden reply')
    })
  })

  describe('Error Handling', () => {
    it('should throw error when typing delay is negative', () => {
      expect(() => mapConfigToBot('test-bot', {
        settings: {
          typing_delay: -100,
        },
      })).toThrow('Typing delay must be non-negative')
    })

    it('should throw error when queue delay is negative', () => {
      expect(() => mapConfigToBot('test-bot', {
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

  describe('Config path management', () => {
    afterEach(() => {
      setConfigPath('')
    })

    it('should return default config path when no custom path set', () => {
      const result = getConfigPath()
      expect(result).toContain('.config')
      expect(result).toContain('wweb-botforge')
      expect(result).toContain('config.yml')
    })

    it('should return custom path after setConfigPath', () => {
      setConfigPath('/tmp/custom-config.yml')
      expect(getConfigPath()).toBe('/tmp/custom-config.yml')
    })

    it('should use custom path in loadConfig', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-path-'))
      const configPath = path.join(tempDir, 'my-config.yml')

      fs.writeFileSync(configPath, 'bots:\n  test-bot:\n    flows:\n      - id: faq')

      const config = await loadConfig(configPath)
      expect(config.bots['test-bot']).toBeDefined()

      fs.rmSync(tempDir, { recursive: true, force: true })
    })
  })

  describe('YAML include processing', () => {
    let tempDir: string

    afterEach(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('should process !include for flow refs inside bot', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-include-'))

      const flowsDir = path.join(tempDir, 'flows')
      fs.mkdirSync(flowsDir)

      fs.writeFileSync(path.join(tempDir, 'config.yml'), `bots:
  my-bot:
    flows:
      - !include flows/faq-ref.yml`)

      fs.writeFileSync(path.join(flowsDir, 'faq-ref.yml'), `id: faq-support
priority: 5`)

      const config = await loadConfig(path.join(tempDir, 'config.yml'))

      expect(config.bots['my-bot'].flows).toHaveLength(1)
      expect(config.bots['my-bot'].flows![0].id).toBe('faq-support')
      expect(config.bots['my-bot'].flows![0].priority).toBe(5)
    })

    it('should process !include for flow branches', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-include-branch-'))

      const branchesDir = path.join(tempDir, 'branches')
      fs.mkdirSync(branchesDir)

      fs.writeFileSync(path.join(tempDir, 'config.yml'), `bots:
  test-bot:
    flows:
      - id: demo
flows:
  demo:
    entry_step: start
    triggers: hi
    steps:
      start:
        action: greet
        branches:
          - !include branches/hours.yml`)

      fs.writeFileSync(path.join(branchesDir, 'hours.yml'), `when: hours
goto: show-hours`)

      const config = await loadConfig(path.join(tempDir, 'config.yml'))

      expect(config.flows?.demo.steps.start.branches).toHaveLength(1)
      expect(config.flows!.demo.steps.start.branches![0].goto).toBe('show-hours')
    })
  })

  describe('Save and write config', () => {
    let tempDir: string

    afterEach(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('should save config to file', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-save-'))
      const configPath = path.join(tempDir, 'config.yml')

      const config = {
        global: { logLevel: 'info' as const },
        bots: {
          'test-bot': {
            flows: [{ id: 'faq', priority: 5 }],
          },
        },
      }

      await saveConfig(config, configPath)
      expect(fs.existsSync(configPath)).toBe(true)

      const loaded = await loadConfig(configPath)
      expect(loaded.bots['test-bot']).toBeDefined()
      expect(loaded.global?.logLevel).toBe('info')
    })

    it('should create directory structure when saving', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-save-dir-'))
      const deepPath = path.join(tempDir, 'sub', 'dir', 'config.yml')

      await saveConfig({ bots: { test: {} } }, deepPath)
      expect(fs.existsSync(deepPath)).toBe(true)
    })

    it('should throw when save fails', async () => {
      const readOnlyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-readonly-'))
      try {
        fs.chmodSync(readOnlyDir, 0o444)
        const writePath = path.join(readOnlyDir, 'config.yml')
        await expect(saveConfig({ bots: { test: {} } }, writePath)).rejects.toThrow(
          'Failed to write configuration'
        )
      } finally {
        fs.chmodSync(readOnlyDir, 0o755)
      }
    })
  })

  describe('Add bot config', () => {
    let tempDir: string
    let configPath: string

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-addbot-'))
      configPath = path.join(tempDir, 'config.yml')
    })

    afterEach(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('should add a new bot to existing config', async () => {
      await saveConfig({
        bots: { existing: {} },
      }, configPath)

      await addBotConfig('new-bot', { flows: [{ id: 'faq' }] }, configPath)

      const config = await loadConfig(configPath)
      expect(config.bots['existing']).toBeDefined()
      expect(config.bots['new-bot']).toBeDefined()
      expect(config.bots['new-bot'].flows![0].id).toBe('faq')
    })

    it('should create config file when it does not exist', async () => {
      await addBotConfig('first-bot', {}, configPath)

      const config = await loadConfig(configPath)
      expect(config.bots['first-bot']).toBeDefined()
    })

    it('should throw when adding duplicate bot', async () => {
      await saveConfig({ bots: { dup: {} } }, configPath)

      await expect(addBotConfig('dup', {}, configPath)).rejects.toThrow(
        'Bot with ID "dup" already exists'
      )
    })

    it('should add bot with settings', async () => {
      await addBotConfig('configured', {
        settings: {
          simulate_typing: false,
          typing_delay: 500,
        },
      }, configPath)

      const config = await loadConfig(configPath)
      expect(config.bots['configured'].settings?.simulate_typing).toBe(false)
      expect(config.bots['configured'].settings?.typing_delay).toBe(500)
    })
  })

  describe('Update bot config', () => {
    let tempDir: string
    let configPath: string

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-upd-'))
      configPath = path.join(tempDir, 'config.yml')
    })

    afterEach(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('should update existing bot', async () => {
      await saveConfig({ bots: { target: { flows: [{ id: 'old' }] } } }, configPath)

      await updateBotConfig('target', { flows: [{ id: 'new', priority: 99 }] }, configPath)

      const config = await loadConfig(configPath)
      expect(config.bots['target'].flows![0].id).toBe('new')
      expect(config.bots['target'].flows![0].priority).toBe(99)
    })

    it('should throw when updating non-existent bot', async () => {
      await saveConfig({ bots: { existing: {} } }, configPath)

      await expect(updateBotConfig('ghost', {}, configPath)).rejects.toThrow(
        'Bot with ID "ghost" not found'
      )
    })

    it('should throw when config file does not exist', async () => {
      const missingPath = path.join(tempDir, 'nonexistent.yml')

      await expect(updateBotConfig('bot', {}, missingPath)).rejects.toThrow(
        'Configuration file does not exist'
      )
    })
  })
})
