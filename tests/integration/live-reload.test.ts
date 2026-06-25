import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { BotFleet } from '../../src/fleet'
import { OutboxService } from '../../src/messages/outbox'
import { ConfigWatcher } from '../../src/config/watcher'
import { loadConfig } from '../../src/config/yaml'
import { IncomingMessage } from '../../src/messages/contracts'
import { SessionManager } from '../../src/whatsapp/session'
import { MockChannel } from '../unit/helpers/mock-channel'

jest.mock('../../src/whatsapp/client', () => ({
  WhatsAppChannel: jest.fn().mockImplementation((id: string) => new MockChannel()),
  setGlobalConfig: jest.fn(),
  getWwebCacheDir: jest.fn(() => mockCacheDir),
}))

let mockCacheDir = ''

function makeMessage(from: string, content: string): IncomingMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from,
    to: 'bot',
    content,
    timestamp: new Date(),
  }
}

describe('Live reload integration', () => {
  let tempDir: string
  let configPath: string
  let fleet: BotFleet
  let outbox: OutboxService
  let watcher: ConfigWatcher
  let sentMessages: Array<{ to: string; content: string }>

  function writeActions(actions: Record<string, string>) {
    const dir = path.join(tempDir, 'actions')
    fs.mkdirSync(dir, { recursive: true })
    for (const [id, reply] of Object.entries(actions)) {
      fs.writeFileSync(path.join(dir, `${id}.yml`), `reply: "${reply}"`)
    }
  }

  function writeFlows(flows: Record<string, string>) {
    const dir = path.join(tempDir, 'flows')
    fs.mkdirSync(dir, { recursive: true })
    for (const [id, yaml] of Object.entries(flows)) {
      fs.writeFileSync(path.join(dir, `${id}.yml`), yaml)
    }
  }

  function writeBots(bots: Record<string, string>) {
    const dir = path.join(tempDir, 'bots')
    fs.mkdirSync(dir, { recursive: true })
    for (const [id, yaml] of Object.entries(bots)) {
      fs.writeFileSync(path.join(dir, `${id}.yml`), yaml)
    }
  }

  function writeMainConfig() {
    fs.writeFileSync(configPath, 'sessionTimeout: 300\n')
  }

  async function sendMessage(from: string, content: string): Promise<void> {
    const bot = fleet.getBots().values().next().value
    if (!bot) return
    const executor = fleet.getFlowExecutor()
    if (!executor) return
    await executor.handleMessage(bot, makeMessage(from, content))
  }

  function replyContains(text: string): boolean {
    return sentMessages.some(m => m.content.includes(text))
  }

  beforeAll(() => {
    SessionManager.getInstance().removeAllChannels()
  })

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-reload-'))
    mockCacheDir = tempDir
    configPath = path.join(tempDir, 'config.yml')
    sentMessages = []

    outbox = {
      enqueue: jest.fn((_botId: string, to: string, content: string) => {
        sentMessages.push({ to, content })
        return `msg-${Date.now()}`
      }),
      setupBotQueue: jest.fn(),
      shutdown: jest.fn(),
      getBotQueueStatus: jest.fn(() => ({ queueSize: 0 })),
      clearBotQueue: jest.fn(),
      getAllQueuesStatus: jest.fn(() => ({ totalQueues: 0, queues: [] })),
      setBotDelay: jest.fn(),
      setBotSendCallback: jest.fn(),
    } as unknown as OutboxService

    fleet = new BotFleet(outbox)
  })

  afterEach(async () => {
    if (watcher) watcher.stop()
    if (fleet.isRunningStatus()) await fleet.stop()
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
    SessionManager.getInstance().removeAllChannels()
  })

  it('replies with updated action text after reload', async () => {
    writeActions({ greet: 'Hello' })
    writeFlows({
      faq: `entry_step: greet\ntriggers: "hello"\nsteps:\n  greet:\n    action: greet\n    branches: []`,
    })
    writeBots({ testbot: 'flows:\n  - id: faq\n    priority: 10' })
    writeMainConfig()

    const config = await loadConfig(configPath)
    await fleet.start(config)
    watcher = new ConfigWatcher(fleet, configPath)

    await sendMessage('user1', 'hello')
    expect(replyContains('Hello')).toBe(true)

    writeActions({ greet: 'Hi there', farewell: 'Bye' })
    await watcher.reload()

    sentMessages = []
    await sendMessage('user1', 'hello')
    expect(replyContains('Hi there')).toBe(true)
  })

  it('matches new branches after reload', async () => {
    writeActions({ greet: 'Main Menu', hours: 'Open 9-18', prices: 'From $10', invalid: 'Invalid', farewell: 'Bye' })
    writeFlows({
      faq: `entry_step: menu\ntriggers: "menu"\nsteps:\n  menu:\n    action: greet\n    branches:\n      - when: "1, hours"\n        goto: hours\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  hours:\n    action: hours\n    branches:\n      - when: "menu, back"\n        goto: menu\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  invalid:\n    action: invalid\n    branches:\n      - goto: menu\n  end:\n    action: farewell\n    branches: []`,
    })
    writeBots({ testbot: 'flows:\n  - id: faq\n    priority: 10' })
    writeMainConfig()

    const config = await loadConfig(configPath)
    await fleet.start(config)
    watcher = new ConfigWatcher(fleet, configPath)

    await sendMessage('user2', 'menu')
    await sendMessage('user2', '1')
    expect(replyContains('Open 9-18')).toBe(true)

    writeFlows({
      faq: `entry_step: menu\ntriggers: "menu"\nsteps:\n  menu:\n    action: greet\n    branches:\n      - when: "1, hours"\n        goto: hours\n      - when: "2, prices"\n        goto: prices\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  hours:\n    action: hours\n    branches:\n      - when: "menu, back"\n        goto: menu\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  prices:\n    action: prices\n    branches:\n      - when: "menu, back"\n        goto: menu\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  invalid:\n    action: invalid\n    branches:\n      - goto: menu\n  end:\n    action: farewell\n    branches: []`,
    })
    await watcher.reload()

    sentMessages = []
    await sendMessage('user2', 'menu')
    await sendMessage('user2', '2')
    expect(replyContains('From $10')).toBe(true)
  })

  it('applies both new actions and new branches after reload', async () => {
    writeActions({ menu_action: 'Old Menu', farewell: 'Bye' })
    writeFlows({
      faq: `entry_step: menu\ntriggers: "menu"\nsteps:\n  menu:\n    action: menu_action\n    branches:\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  invalid:\n    action: menu_action\n    branches:\n      - goto: menu\n  end:\n    action: farewell\n    branches: []`,
    })
    writeBots({ testbot: 'flows:\n  - id: faq\n    priority: 10' })
    writeMainConfig()

    const config = await loadConfig(configPath)
    await fleet.start(config)
    watcher = new ConfigWatcher(fleet, configPath)

    await sendMessage('user3', 'menu')
    expect(replyContains('Old Menu')).toBe(true)

    sentMessages = []
    writeActions({ menu_action: 'New Menu', pricing_action: 'From $50', farewell: 'Bye' })
    writeFlows({
      faq: `entry_step: menu\ntriggers: "menu"\nsteps:\n  menu:\n    action: menu_action\n    branches:\n      - when: "1, pricing"\n        goto: pricing\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  pricing:\n    action: pricing_action\n    branches:\n      - when: "menu, back"\n        goto: menu\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  invalid:\n    action: menu_action\n    branches:\n      - goto: menu\n  end:\n    action: farewell\n    branches: []`,
    })
    await watcher.reload()

    sentMessages = []
    await sendMessage('user3', 'menu')
    expect(replyContains('New Menu')).toBe(true)

    await sendMessage('user3', '1')
    expect(replyContains('From $50')).toBe(true)
  })

  it('active flow session handles new branches added via reload', async () => {
    writeActions({ greet: 'Menu', hours: 'Open 9-18', prices: 'From $10', invalid: 'Invalid', farewell: 'Bye' })
    writeFlows({
      faq: `entry_step: menu\ntriggers: "menu"\nsteps:\n  menu:\n    action: greet\n    branches:\n      - when: "1, hours"\n        goto: hours\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  hours:\n    action: hours\n    branches:\n      - when: "menu, back"\n        goto: menu\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  invalid:\n    action: invalid\n    branches:\n      - goto: menu\n  end:\n    action: farewell\n    branches: []`,
    })
    writeBots({ testbot: 'flows:\n  - id: faq\n    priority: 10' })
    writeMainConfig()

    const config = await loadConfig(configPath)
    await fleet.start(config)
    watcher = new ConfigWatcher(fleet, configPath)

    await sendMessage('user4', 'menu')
    await sendMessage('user4', '1')
    expect(replyContains('Open 9-18')).toBe(true)

    sentMessages = []
    writeFlows({
      faq: `entry_step: menu\ntriggers: "menu"\nsteps:\n  menu:\n    action: greet\n    branches:\n      - when: "1, hours"\n        goto: hours\n      - when: "2, prices"\n        goto: prices\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  hours:\n    action: hours\n    branches:\n      - when: "menu, back"\n        goto: menu\n      - when: "2, prices"\n        goto: prices\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  prices:\n    action: prices\n    branches:\n      - when: "menu, back"\n        goto: menu\n      - when: "0, exit"\n        goto: end\n      - goto: invalid\n  invalid:\n    action: invalid\n    branches:\n      - goto: menu\n  end:\n    action: farewell\n    branches: []`,
    })
    await watcher.reload()

    sentMessages = []
    await sendMessage('user4', 'menu')
    await sendMessage('user4', '2')
    expect(replyContains('From $10')).toBe(true)
  })

  it('removes bot from fleet when bot config is deleted', async () => {
    writeActions({ greet: 'Hello', farewell: 'Bye' })
    writeFlows({
      faq: `entry_step: greet\ntriggers: "hello"\nsteps:\n  greet:\n    action: greet\n    branches:\n      - goto: end\n  end:\n    action: farewell\n    branches: []`,
    })
    writeBots({ testbot: 'flows:\n  - id: faq\n    priority: 10', keeper: 'flows:\n  - id: faq\n    priority: 5' })
    writeMainConfig()

    const config = await loadConfig(configPath)
    await fleet.start(config)
    watcher = new ConfigWatcher(fleet, configPath)

    expect(fleet.getBots().has('testbot')).toBe(true)
    expect(fleet.getBots().has('keeper')).toBe(true)

    const botsDir = path.join(tempDir, 'bots')
    fs.rmSync(path.join(botsDir, 'testbot.yml'))
    await watcher.reload()

    expect(fleet.getBots().has('testbot')).toBe(false)
    expect(fleet.getBots().has('keeper')).toBe(true)
  })

  it('adds new bot to fleet via reload', async () => {
    writeActions({ greet: 'Hello' })
    writeFlows({
      faq: `entry_step: greet\ntriggers: "hello"\nsteps:\n  greet:\n    action: greet\n    branches: []`,
    })
    writeBots({ dummy: 'flows:\n  - id: faq\n    priority: 10' })
    writeMainConfig()

    const config = await loadConfig(configPath)
    await fleet.start(config)
    watcher = new ConfigWatcher(fleet, configPath)

    expect(fleet.getBots().has('dummy')).toBe(true)

    writeBots({ dummy: 'flows:\n  - id: faq\n    priority: 10', newbot: 'flows:\n  - id: faq\n    priority: 10' })
    await watcher.reload()

    expect(fleet.getBots().has('newbot')).toBe(true)
    expect(fleet.getBots().has('dummy')).toBe(true)
  })
})
