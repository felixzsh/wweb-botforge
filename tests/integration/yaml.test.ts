import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { loadConfig, saveConfig, setConfigPath, getConfigPath, addBotConfig } from '../../src/config/yaml'
import { mapConfigToBot, mapBotsFromConfig, mapSettings, mapActionCatalog, mapGraphCatalog } from '../../src/config/mapper'
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
        expect(bot.graph).toBe('')
      })
    })

    describe('Full Configuration', () => {
      it('should load full configuration with actions, graphs and multiple bots', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/full-config.yml')

        const config = await loadConfig(fixturePath)

        expect(config.default_timeout).toBe(300)
        expect(config.log_level).toBe('info')
        expect(config.actions).toBeDefined()
        expect(config.graphs).toBeDefined()
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
        expect(escalate.guards?.cooldown?.duration).toBe(120)
        expect(escalate.steps[0] as any).toEqual({ message: { body: 'Connecting you to a human agent.' } })
        expect((escalate.steps[1] as any).request.name).toBe('escalate-human')
        expect((escalate.steps[1] as any).request.method).toBe('POST')
        expect((escalate.steps[1] as any).request.timeout).toBe(10000)
        expect((escalate.steps[1] as any).request.retries).toBe(3)

        const leadNotify = catalog.get('lead-notify')!
        expect((leadNotify.steps[0] as any).request.url).toBe('https://crm.example.com/leads')
        expect(leadNotify.steps).toHaveLength(1)
      })

      it('should map all graphs from full config', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/full-config.yml')

        const config = await loadConfig(fixturePath)
        const catalog = mapGraphCatalog(config.graphs!)

        expect(catalog.has('faq-support')).toBe(true)
        expect(catalog.has('ping-pong')).toBe(true)

        const faq = catalog.get('faq-support')!
        expect(faq.root).toBe('menu')
        expect(faq.timeout).toBe(300)
        expect(faq.fallbackNode).toBe('invalid')
        expect(Object.keys(faq.nodes)).toHaveLength(6)

        const menuNode = faq.nodes.menu
        expect(menuNode.edges).toHaveLength(4)
        expect(menuNode.edges[0].match).toEqual(['1', 'hours', 'schedule'])
        expect(menuNode.edges[3].match).toBeUndefined()

        const pingPong = catalog.get('ping-pong')!
        expect(pingPong.nodes.ping.edges).toHaveLength(0)
      })

      it('should map support bot with graph reference', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/full-config.yml')

        const config = await loadConfig(fixturePath)
        const bot = mapConfigToBot('support-bot', config.bots['support-bot'])

        expect(bot.graph).toBe('faq-support')
        expect(bot.settings.queueDelay).toBe(1500)
        expect(bot.settings.simulateTyping).toBe(true)
        expect(bot.settings.ignoredSenders).toEqual(['status@broadcast'])
        expect(bot.settings.adminNumbers).toEqual(['9999999999'])
      })

      it('should map sales bot with partial settings', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/full-config.yml')

        const config = await loadConfig(fixturePath)
        const bot = mapConfigToBot('sales-bot', config.bots['sales-bot'])

        expect(bot.graph).toBe('faq-support')
        expect(bot.settings.ignoreGroups).toBe(false)
        expect(bot.settings.ignoredSenders).toEqual([])
      })
    })
  })

  describe('Action Validation', () => {
    it('should throw when action has no steps and no on_blocked', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/action-empty.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapActionCatalog(config.actions!)).toThrow(
        'Action "broken-action" must define steps or a cooldown guard with on_blocked'
      )
    })

    it('should apply request defaults for minimal request action', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/action-request-minimal.yml')

      const config = await loadConfig(fixturePath)
      const catalog = mapActionCatalog(config.actions!)

      const action = catalog.get('notify')!
      expect((action.steps[0] as any).request.url).toBe('https://example.com/hook')
      expect((action.steps[0] as any).request.method).toBe('POST')
      expect((action.steps[0] as any).request.timeout).toBe(5000)
      expect((action.steps[0] as any).request.retries).toBe(3)
      expect((action.steps[0] as any).request.headers).toEqual({})
    })
  })

  describe('Graph Validation', () => {
    it('should throw when root node does not exist', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/graph-bad-root.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapGraphCatalog(config.graphs!)).toThrow(
        'Graph "broken-graph" root node "nonexistent" not found'
      )
    })

    it('should throw when fallback node does not exist', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/graph-bad-fallback.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapGraphCatalog(config.graphs!)).toThrow(
        'Graph "broken-graph" fallback node "nonexistent" not found'
      )
    })

    it('should throw when nodes map is empty', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/graph-no-nodes.yml')

      const config = await loadConfig(fixturePath)

      expect(() => mapGraphCatalog(config.graphs!)).toThrow(
        'Graph "broken-graph" root node "start" not found'
      )
    })
  })

  describe('Bot Validation', () => {
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

      const graphCatalog = mapGraphCatalog(config.graphs!)
      expect(graphCatalog.has('simple-graph')).toBe(true)

      const bot = mapConfigToBot('tolerant-bot', config.bots['tolerant-bot'])
      expect(bot.settings.simulateTyping).toBe(false)
    })
  })

  describe('Modular Configuration', () => {
    it('should load actions from adjacent actions/ directory', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/modular/config.yml')

      const config = await loadConfig(fixturePath)

      expect(config.actions?.greet).toBeDefined()
      expect(config.actions?.greet.steps?.[0]?.message?.body).toBe('Hello! Welcome to our support chat. How can I help you?')
      expect(config.actions?.menu).toBeDefined()
      expect(config.actions?.hours).toBeDefined()
      expect(config.actions?.invalid).toBeDefined()
    })

    it('should load graphs from adjacent graphs/ directory', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/modular/config.yml')

      const config = await loadConfig(fixturePath)

      expect(config.graphs?.faq).toBeDefined()
      expect(config.graphs?.faq.root).toBe('menu')
      expect(config.graphs?.faq.fallback).toBe('invalid')
    })

    it('should load bots from adjacent bots/ directory', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/modular/config.yml')

      const config = await loadConfig(fixturePath)

      expect(config.bots['support-bot']).toBeDefined()
      expect(config.bots['sales-bot']).toBeDefined()
      expect(config.bots['support-bot'].graph).toBe('faq')
      expect(config.bots['sales-bot'].graph).toBe('faq')
    })

    it('should map bots loaded from directory', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/modular/config.yml')

      const config = await loadConfig(fixturePath)
      const bots = mapBotsFromConfig(config.bots)

      expect(bots).toHaveLength(2)
      const supportBot = bots.find(b => b.id === 'support-bot')!
      expect(supportBot.settings.queueDelay).toBe(1500)
      expect(supportBot.settings.ignoreGroups).toBe(true)
      expect(supportBot.graph).toBe('faq')

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
default_timeout: 600
bots:
  support-bot:
    graph: faq
    settings:
      queue_delay: 9999
`)

      fs.writeFileSync(path.join(botsDir, 'support-bot.yml'), `
graph: faq
settings:
  queue_delay: 500
`)

      const config = await loadConfig(configPath)

      expect(Object.keys(config.bots)).toHaveLength(1)
      const bot = mapConfigToBot('support-bot', config.bots['support-bot'])
      expect(bot.graph).toBe('faq')
      expect(bot.settings.queueDelay).toBe(9999)
    })

    it('should let inline action override directory action with same id', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-config-'))

      const configPath = path.join(tempDir, 'config.yml')
      const actionsDir = path.join(tempDir, 'actions')
      const graphsDir = path.join(tempDir, 'graphs')
      fs.mkdirSync(actionsDir)
      fs.mkdirSync(graphsDir)

      fs.writeFileSync(configPath, `
bots:
  test-bot:
    graph: test-graph
actions:
  greet:
    steps:
      - message:
          body: "Overridden reply"
graphs:
  test-graph:
    root: start
    nodes:
      start:
        action: greet
        edges: []
`)

      fs.writeFileSync(path.join(actionsDir, 'greet.yml'), `
steps:
  - message:
      body: "Original reply from directory"
`)

      const config = await loadConfig(configPath)
      expect(config.actions?.greet.steps?.[0]?.message?.body).toBe('Overridden reply')
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

  describe('Configuration with Actions and Graphs Directories', () => {
    let tempDir: string

    afterEach(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('should load actions and graphs from adjacent directories', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-config-'))

      const configPath = path.join(tempDir, 'config.yml')
      const actionsDir = path.join(tempDir, 'actions')
      const graphsDir = path.join(tempDir, 'graphs')

      fs.mkdirSync(actionsDir)
      fs.mkdirSync(graphsDir)

      fs.writeFileSync(configPath, `
default_timeout: 120
bots:
  test-bot:
    graph: faq-menu
`)

      fs.writeFileSync(path.join(actionsDir, 'greet.yml'), `
steps:
  - message:
      body: "Hello! Choose an option"
`)

      fs.writeFileSync(path.join(graphsDir, 'faq-menu.yml'), `
root: menu
nodes:
  menu:
    action: greet
    edges: []
`)

      const config = await loadConfig(configPath)

      expect(config.actions).toBeDefined()
      expect(config.actions?.greet).toBeDefined()
      expect(config.actions?.greet.steps?.[0]?.message?.body).toBe('Hello! Choose an option')

      expect(config.graphs).toBeDefined()
      expect(config.graphs?.['faq-menu']).toBeDefined()
      expect(config.graphs?.['faq-menu'].root).toBe('menu')
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

      fs.writeFileSync(configPath, 'bots:\n  test-bot:\n    graph: any-graph')

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

    it('should process !include for graph edges', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-include-'))

      const edgesDir = path.join(tempDir, 'edges')
      fs.mkdirSync(edgesDir)

      fs.writeFileSync(path.join(tempDir, 'config.yml'), `bots:
  test-bot:
    graph: demo
actions:
  greet:
    steps:
      - message:
          body: "Hello"
graphs:
  demo:
    root: start
    nodes:
      start:
        action: greet
        edges:
          - !include edges/hours-edge.yml`)

      fs.writeFileSync(path.join(edgesDir, 'hours-edge.yml'), `match: hours
goto: hours-node`)

      const config = await loadConfig(path.join(tempDir, 'config.yml'))

      expect(config.graphs?.demo.nodes.start.edges).toHaveLength(1)
      expect(config.graphs!.demo.nodes.start.edges![0].goto).toBe('hours-node')
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
        log_level: 'info' as const,
        bots: {
          'test-bot': {
            graph: 'faq',
          },
        },
      }

      await saveConfig(config, configPath)
      expect(fs.existsSync(configPath)).toBe(true)

      const loaded = await loadConfig(configPath)
      expect(loaded.bots['test-bot']).toBeDefined()
      expect(loaded.log_level).toBe('info')
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

  describe('Add bot config (modular)', () => {
    let tempDir: string
    let configPath: string
    let botsDir: string

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-modbot-'))
      configPath = path.join(tempDir, 'config.yml')
      botsDir = path.join(tempDir, 'bots')
    })

    afterEach(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('should create bot file in bots/ directory', async () => {
      await addBotConfig('my-bot', { settings: { queue_delay: 500 } }, configPath)

      const botFile = path.join(botsDir, 'my-bot.yml')
      expect(fs.existsSync(botFile)).toBe(true)

      const content = fs.readFileSync(botFile, 'utf8')
      expect(content).toContain('queue_delay: 500')
    })

    it('should create bots/ directory when it does not exist', async () => {
      expect(fs.existsSync(botsDir)).toBe(false)

      await addBotConfig('new-bot', {}, configPath)

      expect(fs.existsSync(botsDir)).toBe(true)
    })

    it('should throw when bot ID already exists', async () => {
      await addBotConfig('dup', {}, configPath)

      await expect(addBotConfig('dup', {}, configPath)).rejects.toThrow(
        'Bot with ID "dup" already exists'
      )
    })

    it('should create minimal config.yml when it does not exist', async () => {
      expect(fs.existsSync(configPath)).toBe(false)

      await addBotConfig('first-bot', {}, configPath)

      expect(fs.existsSync(configPath)).toBe(true)
      const content = fs.readFileSync(configPath, 'utf8')
      expect(content).toContain('bots:')
    })

    it('should not modify existing config.yml', async () => {
      await saveConfig({
        default_timeout: 999,
        bots: { existing: {} },
      }, configPath)

      const originalContent = fs.readFileSync(configPath, 'utf8')

      await addBotConfig('another', {}, configPath)

      const afterContent = fs.readFileSync(configPath, 'utf8')
      expect(afterContent).toBe(originalContent)
    })

    it('should load bot via loadConfig after add', async () => {
      await addBotConfig('loadable', { settings: { ignore_groups: false } }, configPath)

      const config = await loadConfig(configPath)
      expect(config.bots['loadable']).toBeDefined()
      expect(config.bots['loadable'].settings?.ignore_groups).toBe(false)
    })

    it('should write bot with graph and settings', async () => {
      await addBotConfig('full', {
        graph: 'faq',
        settings: { queue_delay: 2000, simulate_typing: false },
      }, configPath)

      const botFile = path.join(botsDir, 'full.yml')
      const content = fs.readFileSync(botFile, 'utf8')
      expect(content).toContain('graph: faq')
      expect(content).toContain('queue_delay: 2000')
      expect(content).toContain('simulate_typing:')
    })

    it('should handle custom config path', async () => {
      const customPath = path.join(tempDir, 'custom', 'config.yml')

      await addBotConfig('custom-bot', {}, customPath)

      const customBotsDir = path.join(tempDir, 'custom', 'bots')
      expect(fs.existsSync(path.join(customBotsDir, 'custom-bot.yml'))).toBe(true)
      expect(fs.existsSync(customPath)).toBe(true)
    })
  })
})
