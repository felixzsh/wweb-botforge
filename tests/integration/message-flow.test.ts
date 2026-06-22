import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { BotFleet } from '../../src/fleet'
import { OutboxService } from '../../src/messages/outbox'
import { ConfigFile } from '../../src/config/schema'
import { MockChannel } from '../unit/helpers/mock-channel'

let mockConfigDir: string
jest.mock('../../src/config/yaml', () => ({
  getConfigPath: jest.fn(() => path.join(mockConfigDir, 'config.yml')),
}))

jest.mock('../../src/whatsapp/client', () => ({
  WhatsAppChannel: jest.fn().mockImplementation(() => new MockChannel()),
  setGlobalConfig: jest.fn(),
  getWwebCacheDir: jest.fn(() => mockConfigDir),
}))

describe('Message flow end-to-end', () => {
  let fleet: BotFleet
  let outbox: OutboxService
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-flow-int-'))
    mockConfigDir = tempDir
    outbox = new OutboxService()
    fleet = new BotFleet(outbox)
    jest.useFakeTimers()
  })

  afterEach(async () => {
    jest.useRealTimers()
    if (fleet.isRunningStatus()) {
      await fleet.stop()
    }
    await outbox.shutdown()
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  function makeConfig(overrides?: Partial<ConfigFile>): ConfigFile {
    return {
      global: { sessionTimeout: 300 },
      actions: {},
      flows: {},
      bots: {
        'test-bot': {
          settings: { queue_delay: 0, simulate_typing: false },
        },
      },
      ...overrides,
    }
  }

  it('should reply to a trigger message', async () => {
    await fleet.start(makeConfig({
      actions: { greet: { reply: 'Hello {{sender}}!' } },
      flows: {
        main: {
          entry_step: 'start',
          triggers: 'hi',
          steps: {
            start: { action: 'greet', branches: [] },
          },
        },
      },
      bots: {
        'test-bot': {
          flows: [{ id: 'main', priority: 1 }],
          settings: { queue_delay: 0, simulate_typing: false },
        },
      },
    }))

    const channel = fleet.getBots().get('test-bot')!.channel as MockChannel

    await channel.simulateMessage({
      id: 'msg-1',
      from: '521234567890',
      to: 'test-bot',
      content: 'hi',
      timestamp: new Date(),
    })

    jest.runAllTimers()
    await Promise.resolve()

    expect(channel.sentMessages).toHaveLength(1)
    expect(channel.sentMessages[0].content).toBe('Hello 521234567890!')
  })

  it('should transition between flow steps', async () => {
    await fleet.start(makeConfig({
      actions: {
        menu: { reply: '1. Hours\n2. Info' },
        hours: { reply: 'Open 9-18h' },
      },
      flows: {
        faq: {
          entry_step: 'menu',
          triggers: 'start',
          steps: {
            menu: {
              action: 'menu',
              branches: [
                { when: '1', goto: 'hours' },
                { when: '2', goto: 'info' },
              ],
            },
            hours: { action: 'hours', branches: [] },
            info: { action: 'menu', branches: [] },
          },
        },
      },
      bots: {
        'test-bot': {
          flows: [{ id: 'faq', priority: 1 }],
          settings: { queue_delay: 0, simulate_typing: false },
        },
      },
    }))

    const channel = fleet.getBots().get('test-bot')!.channel as MockChannel

    await channel.simulateMessage({
      id: 'msg-1', from: '521234567890', to: 'test-bot',
      content: 'start', timestamp: new Date(),
    })

    jest.runAllTimers()
    await Promise.resolve()
    jest.runAllTimers()
    await Promise.resolve()

    expect(channel.sentMessages).toHaveLength(1)
    expect(channel.sentMessages[0].content).toContain('1. Hours')

    await channel.simulateMessage({
      id: 'msg-2', from: '521234567890', to: 'test-bot',
      content: '1', timestamp: new Date(),
    })

    jest.runAllTimers()
    await Promise.resolve()
    jest.runAllTimers()
    await Promise.resolve()

    expect(channel.sentMessages).toHaveLength(2)
    expect(channel.sentMessages[1].content).toBe('Open 9-18h')
  })

  it('should ignore messages from self', async () => {
    await fleet.start(makeConfig({
      actions: { greet: { reply: 'Hello!' } },
      flows: {
        main: {
          entry_step: 'start', triggers: 'hi',
          steps: { start: { action: 'greet', branches: [] } },
        },
      },
      bots: {
        'test-bot': {
          flows: [{ id: 'main', priority: 1 }],
          settings: { queue_delay: 0, simulate_typing: false },
        },
      },
    }))

    const channel = fleet.getBots().get('test-bot')!.channel as MockChannel

    await channel.simulateMessage({
      id: 'msg-1', from: 'test-bot', to: 'test-bot',
      content: 'hi', timestamp: new Date(),
      metadata: { fromMe: true },
    })

    jest.runAllTimers()
    await Promise.resolve()

    expect(channel.sentMessages).toHaveLength(0)
  })
})
