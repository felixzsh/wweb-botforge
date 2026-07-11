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

jest.mock('../../src/helpers/data', () => ({
  getDataDir: jest.fn(() => mockConfigDir),
}))

describe('Fleet lifecycle integration', () => {
  let fleet: BotFleet
  let outbox: OutboxService
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforje-fleet-int-'))
    mockConfigDir = tempDir
    outbox = new OutboxService()
    fleet = new BotFleet(outbox)
  })

  afterEach(async () => {
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
      bots: {
        'bot-1': {
          settings: { queue_delay: 0, simulate_typing: false },
        },
      },
      ...overrides,
    }
  }

  it('should start and stop with one bot', async () => {
    const result = await fleet.start(makeConfig())

    expect(result.size).toBe(1)
    expect(fleet.isRunningStatus()).toBe(true)

    const bot = result.get('bot-1')
    expect(bot).toBeDefined()
    expect(bot!.channel).toBeDefined()

    await fleet.stop()
    expect(fleet.isRunningStatus()).toBe(false)
  })

  it('should start and stop with multiple bots', async () => {
    const result = await fleet.start(makeConfig({
      bots: {
        'bot-1': { settings: { queue_delay: 0, simulate_typing: false } },
        'bot-2': { settings: { queue_delay: 0, simulate_typing: false } },
      },
    }))

    expect(result.size).toBe(2)
    expect(fleet.isRunningStatus()).toBe(true)

    await fleet.stop()
    expect(fleet.isRunningStatus()).toBe(false)
  }, 15000)

  it('should get status after starting', async () => {
    await fleet.start(makeConfig({ bots: { 'bot-a': { settings: { queue_delay: 0, simulate_typing: false } } } }))

    const status = fleet.getStatus()
    expect(status.isRunning).toBe(true)
    expect(status.totalBots).toBe(1)
    expect(status.bots[0].id).toBe('bot-a')
  })

  it('should clean up channel on stop', async () => {
    await fleet.start(makeConfig())

    const bot = fleet.getBots().get('bot-1')!
    const channel = bot.channel as MockChannel
    expect(channel.connected).toBe(true)

    await fleet.stop()
    expect(channel.connected).toBe(false)
  })

  it('should set phone number from channel on ready', async () => {
    await fleet.start(makeConfig())

    const bot = fleet.getBots().get('bot-1')!
    const channel = bot.channel as MockChannel

    expect(bot.phone).toBe(channel.phoneNumber)
  })
})
