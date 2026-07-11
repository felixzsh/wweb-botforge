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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botdeck-graph-int-'))
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
      default_timeout: 300,
      actions: {},
      graphs: {},
      bots: {
        'test-bot': {
          graph: 'main',
          settings: { queue_delay: 0, simulate_typing: false },
        },
      },
      ...overrides,
    }
  }

  it('should execute root action on first message', async () => {
    await fleet.start(makeConfig({
      actions: { greet: { steps: [{ message: { body: 'Hello {{senderPhone}}!' } }] } },
      graphs: {
        main: {
          root: 'start',
          nodes: {
            start: { action: 'greet', edges: [] },
          },
        },
      },
      bots: {
        'test-bot': {
          graph: 'main',
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

  it('should transition between nodes on matching edge', async () => {
    await fleet.start(makeConfig({
      actions: {
        menu: { steps: [{ message: { body: '1. Hours\n2. Info' } }] },
        hours: { steps: [{ message: { body: 'Open 9-18h' } }] },
      },
      graphs: {
        faq: {
          root: 'menu',
          nodes: {
            menu: {
              action: 'menu',
              edges: [
                { match: '1', goto: 'hours' },
                { match: '2', goto: 'info' },
              ],
            },
            hours: { action: 'hours', edges: [] },
            info: { action: 'menu', edges: [] },
          },
        },
      },
      bots: {
        'test-bot': {
          graph: 'faq',
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
      actions: { greet: { steps: [{ message: { body: 'Hello!' } }] } },
      graphs: {
        main: {
          root: 'start',
          nodes: { start: { action: 'greet', edges: [] } },
        },
      },
      bots: {
        'test-bot': {
          graph: 'main',
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
