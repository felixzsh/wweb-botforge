import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { BotFleet } from '../../src/fleet'
import { OutboxService } from '../../src/messages/outbox'
import { SessionManager } from '../../src/whatsapp/session'
import { MockChannel } from './helpers/mock-channel'

jest.mock('../../src/whatsapp/client', () => ({
  WhatsAppChannel: jest.fn().mockImplementation(() => new MockChannel()),
  setGlobalConfig: jest.fn(),
}))

let mockConfigDir: string
jest.mock('../../src/config/yaml', () => ({
  getConfigPath: jest.fn(() => path.join(mockConfigDir, 'config.yml')),
}))

describe('BotFleet', () => {
  let fleet: BotFleet
  let outbox: OutboxService
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botforge-fleet-'))
    mockConfigDir = tempDir
    outbox = new OutboxService()
    fleet = new BotFleet(outbox)
  })

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('constructor', () => {
    it('should create a BotFleet instance', () => {
      expect(fleet).toBeDefined()
    })
  })

  describe('isRunningStatus', () => {
    it('should return false initially', () => {
      expect(fleet.isRunningStatus()).toBe(false)
    })
  })

  describe('getOutboxService', () => {
    it('should return the injected outbox service', () => {
      expect(fleet.getOutboxService()).toBe(outbox)
    })
  })

  describe('getBots', () => {
    it('should return empty map initially', () => {
      expect(fleet.getBots().size).toBe(0)
    })
  })

  describe('getStatus', () => {
    it('should return default status when not running', () => {
      const status = fleet.getStatus()
      expect(status.isRunning).toBe(false)
      expect(status.bots).toEqual([])
      expect(status.totalBots).toBe(0)
    })
  })

  describe('stop', () => {
    it('should do nothing when not running', async () => {
      await expect(fleet.stop()).resolves.toBeUndefined()
    })
  })

  describe('start', () => {
    it('should warn and return when no bots configured', async () => {
      const config = { bots: {} }
      const result = await fleet.start(config as any)
      expect(result.size).toBe(0)
      expect(fleet.isRunningStatus()).toBe(false)
    })

    it('should start bots from config', async () => {
      const sessionManager = SessionManager.getInstance()
      jest.spyOn(sessionManager, 'createChannel').mockImplementation(() => new MockChannel())
      jest.spyOn(sessionManager, 'removeAllChannels').mockImplementation(async () => {})

      const config = {
        global: { sessionTimeout: 300 },
        bots: { 'test-bot': {} },
      } as any

      const result = await fleet.start(config)

      expect(result.size).toBe(1)
      expect(fleet.isRunningStatus()).toBe(true)
    })
  })
})
