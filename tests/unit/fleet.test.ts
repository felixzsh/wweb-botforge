import { BotFleet } from '../../src/fleet'
import { OutboxService } from '../../src/messages/outbox'

describe('BotFleet (unit)', () => {
  let fleet: BotFleet
  let outbox: OutboxService

  beforeEach(() => {
    outbox = new OutboxService()
    fleet = new BotFleet(outbox)
  })

  afterEach(async () => {
    await outbox.shutdown()
  })

  it('should create a BotFleet instance', () => {
    expect(fleet).toBeDefined()
  })

  it('should return false initially', () => {
    expect(fleet.isRunningStatus()).toBe(false)
  })

  it('should return the injected outbox service', () => {
    expect(fleet.getOutboxService()).toBe(outbox)
  })

  it('should return empty map initially', () => {
    expect(fleet.getBots().size).toBe(0)
  })

  it('should return default status when not running', () => {
    const status = fleet.getStatus()
    expect(status.isRunning).toBe(false)
    expect(status.bots).toEqual([])
    expect(status.totalBots).toBe(0)
  })

  it('should do nothing when stopping while not running', async () => {
    await expect(fleet.stop()).resolves.toBeUndefined()
  })
})
