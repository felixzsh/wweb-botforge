import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { FlowStateService } from '../../src/flow/state'

describe('FlowStateService', () => {
  let dbPath: string
  let service: FlowStateService

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `botforge-flow-state-test-${Date.now()}.db`)
    service = new FlowStateService(dbPath)
  })

  afterEach(() => {
    service.close()
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  })

  it('should create and find an active flow state', () => {
    const state = service.create('521234567890', 'bot-1', 'faq-menu', 'menu', 300)

    expect(state.sender).toBe('521234567890')
    expect(state.botId).toBe('bot-1')
    expect(state.flowId).toBe('faq-menu')
    expect(state.stepId).toBe('menu')

    const found = service.findActive('521234567890', 'bot-1')
    expect(found).not.toBeNull()
    expect(found?.stepId).toBe('menu')
  })

  it('should update step and variables', () => {
    const state = service.create('521234567890', 'bot-1', 'faq-menu', 'menu', 300)

    service.updateStep(state.id, 'hours', { product: 'A' })

    const found = service.findActive('521234567890', 'bot-1')
    expect(found?.stepId).toBe('hours')
    expect(found?.variables.product).toBe('A')
  })

  it('should destroy flow state', () => {
    service.create('521234567890', 'bot-1', 'faq-menu', 'menu', 300)
    service.destroyBySenderBot('521234567890', 'bot-1')

    const found = service.findActive('521234567890', 'bot-1')
    expect(found).toBeNull()
  })

  it('should return null for expired flow states', () => {
    const now = Date.now()
    service.create('521234567890', 'bot-1', 'faq-menu', 'menu', 1, now)

    const found = service.findActive('521234567890', 'bot-1', now + 2000)
    expect(found).toBeNull()
  })

  it('should cleanup expired flow states', () => {
    const now = Date.now()
    service.create('521234567890', 'bot-1', 'faq-menu', 'menu', 1, now)
    service.create('521234567891', 'bot-1', 'faq-menu', 'menu', 300, now)

    const deleted = service.cleanupExpired(now + 2000)

    expect(deleted).toBe(1)
    expect(service.count()).toBe(1)
  })
})
