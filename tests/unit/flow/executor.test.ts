import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { FlowExecutor } from '../../../src/flow/executor'
import { FlowStateService } from '../../../src/flow/state'
import { OutboxService } from '../../../src/messages/outbox'
import { CooldownService } from '../../../src/action/cooldown'
import { mapActionCatalog, mapFlowCatalog } from '../../../src/config/mapper'
import { Bot } from '../../../src/bot'
import { IncomingMessage } from '../../../src/messages/contracts'
import { ActionConfig, FlowConfig } from '../../../src/config/schema'

describe('FlowExecutor', () => {
  let dbPath: string
  let flowStateService: FlowStateService
  let cooldownService: CooldownService
  let outboxService: OutboxService
  let executor: FlowExecutor
  let bot: Bot
  let sentMessages: Array<{ to: string; content: string; metadata?: Record<string, any> }>

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `botforge-flow-test-${Date.now()}.db`)
    flowStateService = new FlowStateService(dbPath)
    cooldownService = new CooldownService()
    sentMessages = []
    outboxService = {
      enqueue: (_botId: string, to: string, content: string, metadata?: Record<string, any>) => {
        sentMessages.push({ to, content, metadata })
        return 'fake-id'
      },
    } as unknown as OutboxService

    const actions: Record<string, ActionConfig> = {
      greet: { reply: 'Menu:\n1. Hours\n2. Prices\n0. Exit' },
      hours: { reply: 'Open Mon-Fri 9-18h' },
      prices: { reply: 'From $10/mo' },
      invalid: { reply: 'Invalid option' },
      farewell: { reply: 'Goodbye!' },
      escalate: { reply: 'Escalating to human.', cooldown: 30, cooldown_reply: 'Please wait, action on cooldown.' },
      cool_reply: { reply: 'Done!', cooldown: 30 },
      webhook_greet: { reply: 'Webhook sent', webhook: { url: 'https://example.com/hook', retry: 1 } },
      webhook_fail: { reply: 'Failed webhook', webhook: { url: 'https://example.com/fail', retry: 1 } },
      webhook_only: { webhook: { url: 'https://example.com/hook-only', retry: 1 } },
      send_office: {
        reply: 'Here is our office.',
        location: {
          latitude: 19.4326,
          longitude: -99.1332,
          name: 'Main Office',
          address: 'Av. Reforma 123',
        },
      },
      send_store_only: {
        location: {
          latitude: 19.4326,
          longitude: -99.1332,
          name: 'Store',
        },
      },
    }

    const flows: Record<string, FlowConfig> = {
      'faq-menu': {
        entry_step: 'menu',
        triggers: 'menu, hola',
        timeout: 300,
        fallback_step: 'invalid',
        steps: {
          menu: {
            action: 'greet',
            branches: [
              { when: '1, hours', goto: 'hours' },
              { when: '2, prices', goto: 'prices' },
              { when: '3, human', goto: 'escalate' },
              { when: '0, exit', goto: 'end' },
              { goto: 'invalid' },
            ],
          },
          hours: {
            action: 'hours',
            branches: [
              { when: 'menu, back', goto: 'menu' },
              { goto: 'invalid' },
            ],
          },
          prices: {
            action: 'prices',
            branches: [
              { when: 'menu, back', goto: 'menu' },
              { goto: 'invalid' },
            ],
          },
          escalate: {
            action: 'escalate',
            branches: [
              { when: 'menu, back', goto: 'menu' },
              { goto: 'invalid' },
            ],
          },
          invalid: {
            action: 'invalid',
            branches: [
              { goto: 'menu' },
            ],
          },
          end: {
            action: 'farewell',
            branches: [],
          },
        },
      },
      'no-fallback': {
        entry_step: 'menu',
        triggers: 'ping',
        steps: {
          menu: {
            action: 'greet',
            branches: [
              { when: 'pong', goto: 'end' },
            ],
          },
          end: {
            action: 'farewell',
            branches: [],
          },
        },
      },
      'has-fallback': {
        entry_step: 'menu',
        triggers: 'fb',
        fallback_step: 'fallback',
        steps: {
          menu: {
            action: 'greet',
            branches: [
              { when: 'correct', goto: 'done' },
            ],
          },
          fallback: {
            action: 'invalid',
            branches: [
              { goto: 'menu' },
            ],
          },
          done: {
            action: 'farewell',
            branches: [],
          },
        },
      },
      'terminal-flow': {
        entry_step: 'done',
        triggers: 'end',
        steps: {
          done: {
            action: 'farewell',
            branches: [],
          },
        },
      },
      'broken-branch': {
        entry_step: 'menu',
        triggers: 'broken',
        steps: {
          menu: {
            action: 'greet',
            branches: [
              { when: 'go', goto: 'missing-step' },
            ],
          },
        },
      },
      'cooldown-simple': {
        entry_step: 'start',
        triggers: 'fire',
        steps: {
          start: {
            action: 'cool_reply',
            branches: [],
          },
        },
      },
      'webhook-flow': {
        entry_step: 'start',
        triggers: 'wh',
        steps: {
          start: {
            action: 'webhook_greet',
            branches: [],
          },
        },
      },
      'webhook-fail': {
        entry_step: 'start',
        triggers: 'whfail',
        steps: {
          start: {
            action: 'webhook_fail',
            branches: [],
          },
        },
      },
      'webhook-only': {
        entry_step: 'start',
        triggers: 'who',
        steps: {
          start: {
            action: 'webhook_only',
            branches: [],
          },
        },
      },
      'no-triggers': {
        entry_step: 'start',
        steps: {
          start: {
            action: 'greet',
            branches: [],
          },
        },
      },
      'location-flow': {
        entry_step: 'start',
        triggers: 'office',
        steps: {
          start: {
            action: 'send_office',
            branches: [],
          },
        },
      },
      'location-only-flow': {
        entry_step: 'start',
        triggers: 'store',
        steps: {
          start: {
            action: 'send_store_only',
            branches: [],
          },
        },
      },
    }

    executor = new FlowExecutor(
      mapActionCatalog(actions),
      mapFlowCatalog(flows),
      flowStateService,
      outboxService,
      300,
      cooldownService
    )

    bot = {
      id: 'support-bot',
      settings: {
        simulateTyping: false,
        typingDelay: 0,
        queueDelay: 0,
        readReceipts: false,
        ignoreGroups: true,
        ignoredSenders: [],
        adminNumbers: [],
      },
      flows: [{ id: 'faq-menu', priority: 1 }],
    }
  })

  afterEach(() => {
    flowStateService.close()
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
    }
  })

  function makeMessage(content: string): IncomingMessage {
    return {
      id: 'msg-1',
      from: '521234567890',
      to: '5210987654321',
      content,
      timestamp: new Date(),
    }
  }

  it('should start a flow when entry trigger matches', async () => {
    const handled = await executor.handleMessage(bot, makeMessage('menu'))

    expect(handled).toBe(true)
    expect(sentMessages).toHaveLength(1)
    expect(sentMessages[0].content).toContain('Menu:')

    const session = flowStateService.findActive('521234567890', 'support-bot')
    expect(session).not.toBeNull()
    expect(session?.stepId).toBe('menu')
  })

  it('should transition to next step on branch match', async () => {
    await executor.handleMessage(bot, makeMessage('menu'))
    const handled = await executor.handleMessage(bot, makeMessage('hours'))

    expect(handled).toBe(true)
    expect(sentMessages).toHaveLength(2)
    expect(sentMessages[1].content).toBe('Open Mon-Fri 9-18h')

    const session = flowStateService.findActive('521234567890', 'support-bot')
    expect(session?.stepId).toBe('hours')
  })

  it('should use fallback step when no branch matches', async () => {
    await executor.handleMessage(bot, makeMessage('menu'))
    const handled = await executor.handleMessage(bot, makeMessage('random answer'))

    expect(handled).toBe(true)
    expect(sentMessages).toHaveLength(2)
    expect(sentMessages[1].content).toBe('Invalid option')

    const session = flowStateService.findActive('521234567890', 'support-bot')
    expect(session?.stepId).toBe('invalid')
  })

  it('should destroy session when reaching terminal step', async () => {
    await executor.handleMessage(bot, makeMessage('menu'))
    await executor.handleMessage(bot, makeMessage('exit'))

    expect(sentMessages[sentMessages.length - 1].content).toBe('Goodbye!')

    const session = flowStateService.findActive('521234567890', 'support-bot')
    expect(session).toBeNull()
  })

  it('should return false when no flow matches', async () => {
    const handled = await executor.handleMessage(bot, makeMessage('completely unrelated'))

    expect(handled).toBe(false)
    expect(sentMessages).toHaveLength(0)
  })

  it('should start new flow when previous session was destroyed', async () => {
    const session = flowStateService.create('521234567890', 'support-bot', 'faq-menu', 'menu', 300)
    flowStateService.destroy(session.id)

    const handled = await executor.handleMessage(bot, makeMessage('menu'))

    expect(handled).toBe(true)
    expect(sentMessages[0].content).toContain('Menu:')

    const newSession = flowStateService.findActive('521234567890', 'support-bot')
    expect(newSession?.stepId).toBe('menu')
  })

  describe('cooldown on actions', () => {
    it('should execute action normally when no cooldown active', async () => {
      await executor.handleMessage(bot, makeMessage('menu'))
      const handled = await executor.handleMessage(bot, makeMessage('human'))

      expect(handled).toBe(true)
      expect(sentMessages[1].content).toBe('Escalating to human.')
    })

    it('should send cooldown_reply when action on cooldown', async () => {
      await executor.handleMessage(bot, makeMessage('menu'))
      await executor.handleMessage(bot, makeMessage('human'))

      expect(sentMessages[1].content).toBe('Escalating to human.')

      await executor.handleMessage(bot, makeMessage('menu'))
      const handled = await executor.handleMessage(bot, makeMessage('human'))

      expect(handled).toBe(true)
      expect(sentMessages[3].content).toBe('Please wait, action on cooldown.')
    })

    it('should navigate from cooldown state naturally', async () => {
      await executor.handleMessage(bot, makeMessage('menu'))
      await executor.handleMessage(bot, makeMessage('human'))
      await executor.handleMessage(bot, makeMessage('menu'))
      await executor.handleMessage(bot, makeMessage('human'))

      expect(sentMessages[3].content).toBe('Please wait, action on cooldown.')

      const handled = await executor.handleMessage(bot, makeMessage('menu'))

      expect(handled).toBe(true)
      expect(sentMessages[4].content).toContain('Menu:')
    })

    it('should return false when action on cooldown without cooldown_reply', async () => {
      bot.flows = [{ id: 'cooldown-simple', priority: 1 }]

      const first = await executor.handleMessage(bot, makeMessage('fire'))
      expect(first).toBe(true)
      expect(sentMessages[0].content).toBe('Done!')

      const second = await executor.handleMessage(bot, makeMessage('fire'))
      expect(second).toBe(false)
      expect(sentMessages).toHaveLength(1)
    })

    it('should skip cooldown checks when no cooldownService set', async () => {
      const noCooldown = new FlowExecutor(
        new Map(),
        new Map(),
        flowStateService,
        outboxService,
        300
      )
      ;(noCooldown as any).actionCatalog = (executor as any).actionCatalog
      ;(noCooldown as any).flowCatalog = (executor as any).flowCatalog

      bot.flows = [{ id: 'cooldown-simple', priority: 1 }]

      const first = await noCooldown.handleMessage(bot, makeMessage('fire'))
      expect(first).toBe(true)
      expect(sentMessages[0].content).toBe('Done!')

      const second = await noCooldown.handleMessage(bot, makeMessage('fire'))
      expect(second).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should destroy session and return false when active flow not in catalog', async () => {
      flowStateService.create('521234567890', 'support-bot', 'ghost-flow', 'menu', 300)

      const handled = await executor.handleMessage(bot, makeMessage('anything'))

      expect(handled).toBe(false)
      expect(flowStateService.findActive('521234567890', 'support-bot')).toBeNull()
    })

    it('should destroy session when active step not in flow', async () => {
      flowStateService.create('521234567890', 'support-bot', 'faq-menu', 'phantom-step', 300)

      const handled = await executor.handleMessage(bot, makeMessage('anything'))

      expect(handled).toBe(false)
      expect(flowStateService.findActive('521234567890', 'support-bot')).toBeNull()
    })

    it('should return true when no branch matches without fallback', async () => {
      bot.flows = [{ id: 'no-fallback', priority: 1 }]

      await executor.handleMessage(bot, makeMessage('ping'))
      expect(sentMessages[0]).toBeDefined()

      const handled = await executor.handleMessage(bot, makeMessage('xyzzy'))

      expect(handled).toBe(true)
      expect(sentMessages).toHaveLength(1)
    })

    it('should warn when bot references non-existent flow', async () => {
      bot.flows = [
        { id: 'non-existent-flow', priority: 10 },
        { id: 'faq-menu', priority: 1 },
      ]

      const handled = await executor.handleMessage(bot, makeMessage('menu'))

      expect(handled).toBe(true)
      expect(sentMessages[0].content).toContain('Menu:')
    })

    it('should warn when flow entry step is not found', async () => {
      const catalog = (executor as any).flowCatalog
      catalog.set('bad-entry', {
        id: 'bad-entry',
        entryStep: 'phantom',
        triggers: [{ phrases: ['bad'] }],
        steps: { start: { action: 'greet', branches: [] } },
      })

      bot.flows = [{ id: 'bad-entry', priority: 10 }]
      const handled = await executor.handleMessage(bot, makeMessage('bad'))

      expect(handled).toBe(false)
    })

    it('should use fallback when no branch matches and no default branch', async () => {
      bot.flows = [{ id: 'has-fallback', priority: 1 }]

      await executor.handleMessage(bot, makeMessage('fb'))
      expect(sentMessages[0]).toBeDefined()

      const handled = await executor.handleMessage(bot, makeMessage('xyzzy'))

      expect(handled).toBe(true)
      expect(sentMessages[1].content).toBe('Invalid option')

      const session = flowStateService.findActive('521234567890', 'support-bot')
      expect(session?.stepId).toBe('fallback')
    })

    it('should handle fallback step pointing to missing step', async () => {
      const catalog = (executor as any).flowCatalog
      catalog.set('bad-fallback', {
        id: 'bad-fallback',
        entryStep: 'start',
        triggers: [{ phrases: ['testfall'] }],
        fallbackStep: 'nope',
        steps: {
          start: {
            action: 'greet',
            branches: [{ when: 'other', goto: 'end' }],
          },
          end: { action: 'farewell', branches: [] },
        },
      })

      bot.flows = [{ id: 'bad-fallback', priority: 1 }]

      await executor.handleMessage(bot, makeMessage('testfall'))
      expect(sentMessages[0]).toBeDefined()

      const handled = await executor.handleMessage(bot, makeMessage('xyzzy'))

      expect(handled).toBe(true)
      expect(sentMessages).toHaveLength(1)
    })

    it('should handle entry step with no branches (terminal)', async () => {
      bot.flows = [{ id: 'terminal-flow', priority: 1 }]

      const handled = await executor.handleMessage(bot, makeMessage('end'))

      expect(handled).toBe(true)
      expect(sentMessages[0].content).toBe('Goodbye!')
      expect(flowStateService.findActive('521234567890', 'support-bot')).toBeNull()
    })

    it('should destroy session when transition targets non-existent step', async () => {
      bot.flows = [{ id: 'broken-branch', priority: 1 }]

      await executor.handleMessage(bot, makeMessage('broken'))
      expect(sentMessages).toHaveLength(1)

      const handled = await executor.handleMessage(bot, makeMessage('go'))

      expect(handled).toBe(true)
      expect(sentMessages).toHaveLength(1)
      expect(flowStateService.findActive('521234567890', 'support-bot')).toBeNull()
    })

    it('should not match flow without triggers', async () => {
      bot.flows = [{ id: 'no-triggers', priority: 1 }]

      const handled = await executor.handleMessage(bot, makeMessage('anything'))

      expect(handled).toBe(false)
    })
  })

  describe('location actions', () => {
    it('should enqueue reply and location when action has both', async () => {
      bot.flows = [{ id: 'location-flow', priority: 1 }]

      const handled = await executor.handleMessage(bot, makeMessage('office'))

      expect(handled).toBe(true)
      expect(sentMessages).toHaveLength(2)
      expect(sentMessages[0].content).toBe('Here is our office.')
      expect(sentMessages[1].content).toBe('')
      expect(sentMessages[1].metadata).toEqual({
        type: 'location',
        latitude: 19.4326,
        longitude: -99.1332,
        name: 'Main Office',
        address: 'Av. Reforma 123',
        url: undefined,
        description: undefined,
      })
    })

    it('should enqueue only location when action has no reply', async () => {
      bot.flows = [{ id: 'location-only-flow', priority: 1 }]

      const handled = await executor.handleMessage(bot, makeMessage('store'))

      expect(handled).toBe(true)
      expect(sentMessages).toHaveLength(1)
      expect(sentMessages[0].content).toBe('')
      expect(sentMessages[0].metadata?.type).toBe('location')
      expect(sentMessages[0].metadata?.latitude).toBe(19.4326)
      expect(sentMessages[0].metadata?.longitude).toBe(-99.1332)
      expect(sentMessages[0].metadata?.name).toBe('Store')
    })
  })

  describe('webhook actions', () => {
    let fetchMock: jest.Mock
    let originalFetch: typeof global.fetch

    beforeAll(() => {
      originalFetch = global.fetch
    })

    beforeEach(() => {
      fetchMock = jest.fn()
      global.fetch = fetchMock as unknown as typeof global.fetch
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('should execute webhook action on entry', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

      bot.flows = [{ id: 'webhook-flow', priority: 1 }]

      const handled = await executor.handleMessage(bot, makeMessage('wh'))

      expect(handled).toBe(true)
      expect(sentMessages[0].content).toBe('Webhook sent')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should not throw when webhook request fails', async () => {
      fetchMock.mockRejectedValue(new Error('Connection refused'))

      bot.flows = [{ id: 'webhook-fail', priority: 1 }]

      const handled = await executor.handleMessage(bot, makeMessage('whfail'))

      expect(handled).toBe(true)
      expect(sentMessages[0].content).toBe('Failed webhook')
    })

    it('should execute webhook-only action without reply', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

      const defaultExec = new FlowExecutor(
        (executor as any).actionCatalog,
        (executor as any).flowCatalog,
        flowStateService,
        outboxService
      )

      bot.flows = [{ id: 'webhook-only', priority: 1 }]

      const handled = await defaultExec.handleMessage(bot, makeMessage('who'))

      expect(handled).toBe(true)
      expect(sentMessages).toHaveLength(0)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/hook-only',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
