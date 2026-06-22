import { SessionManager } from '../../../src/whatsapp/session'
import { MockChannel } from '../helpers/mock-channel'

jest.mock('../../../src/whatsapp/client', () => ({
  WhatsAppChannel: jest.fn().mockImplementation(() => new MockChannel()),
  setGlobalConfig: jest.fn(),
  getPuppeteerOptions: jest.fn(),
  getClientOptions: jest.fn(),
}))

describe('SessionManager', () => {
  let sessionManager: SessionManager

  beforeEach(() => {
    (SessionManager as any).instance = undefined
    sessionManager = SessionManager.getInstance()
  })

  it('should be a singleton', () => {
    const instance1 = SessionManager.getInstance()
    const instance2 = SessionManager.getInstance()
    expect(instance1).toBe(instance2)
  })

  describe('createChannel', () => {
    it('should create and return a channel', () => {
      const channel = sessionManager.createChannel('bot-1')
      expect(channel).toBeDefined()
      expect(sessionManager.hasChannel('bot-1')).toBe(true)
    })

    it('should throw when creating duplicate channel', () => {
      sessionManager.createChannel('bot-1')
      expect(() => sessionManager.createChannel('bot-1')).toThrow(
        'Channel already exists for ID bot-1'
      )
    })
  })

  describe('getChannel', () => {
    it('should return channel by id', () => {
      const created = sessionManager.createChannel('bot-1')
      const retrieved = sessionManager.getChannel('bot-1')
      expect(retrieved).toBe(created)
    })

    it('should return undefined for missing channel', () => {
      expect(sessionManager.getChannel('ghost')).toBeUndefined()
    })
  })

  describe('getAllChannels', () => {
    it('should return all channels', () => {
      sessionManager.createChannel('bot-1')
      sessionManager.createChannel('bot-2')

      const all = sessionManager.getAllChannels()
      expect(all.size).toBe(2)
      expect(all.has('bot-1')).toBe(true)
      expect(all.has('bot-2')).toBe(true)
    })

    it('should return a copy of the channels map', () => {
      sessionManager.createChannel('bot-1')
      const all = sessionManager.getAllChannels()
      all.delete('bot-1')
      expect(sessionManager.hasChannel('bot-1')).toBe(true)
    })
  })

  describe('removeChannel', () => {
    it('should remove existing channel', async () => {
      sessionManager.createChannel('bot-1')
      await sessionManager.removeChannel('bot-1')
      expect(sessionManager.hasChannel('bot-1')).toBe(false)
    })

    it('should do nothing for missing channel', async () => {
      await expect(sessionManager.removeChannel('ghost')).resolves.toBeUndefined()
    })
  })

  describe('removeAllChannels', () => {
    it('should remove all channels', async () => {
      sessionManager.createChannel('bot-1')
      sessionManager.createChannel('bot-2')
      await sessionManager.removeAllChannels()
      expect(sessionManager.getChannelCount()).toBe(0)
    })
  })

  describe('getChannelCount', () => {
    it('should return channel count', () => {
      expect(sessionManager.getChannelCount()).toBe(0)
      sessionManager.createChannel('bot-1')
      expect(sessionManager.getChannelCount()).toBe(1)
    })
  })

  describe('hasChannel', () => {
    it('should return true for existing channel', () => {
      sessionManager.createChannel('bot-1')
      expect(sessionManager.hasChannel('bot-1')).toBe(true)
    })

    it('should return false for missing channel', () => {
      expect(sessionManager.hasChannel('ghost')).toBe(false)
    })
  })
})
