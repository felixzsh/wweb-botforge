import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { GraphExecutor } from '../../../src/graph/executor'
import { GraphStateService } from '../../../src/graph/state'
import { OutboxService } from '../../../src/messages/outbox'
import { CooldownService } from '../../../src/actions/cooldown'
import { mapActionCatalog, mapGraphCatalog } from '../../../src/config/mapper'
import { Bot } from '../../../src/bot'
import { IncomingMessage } from '../../../src/messages/contracts'
import { ActionConfig, GraphConfig } from '../../../src/config/schema'

describe('GraphExecutor', () => {
  let dbPath: string
  let graphStateService: GraphStateService
  let cooldownService: CooldownService
  let outboxService: OutboxService
  let executor: GraphExecutor
  let bot: Bot
  let sentMessages: Array<{ to: string; content: string; metadata?: Record<string, any> }>

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `botforge-graph-test-${Date.now()}.db`)
    graphStateService = new GraphStateService(dbPath)
    cooldownService = new CooldownService()
    sentMessages = []
    outboxService = {
      enqueue: (_botId: string, to: string, content: string, metadata?: Record<string, any>) => {
        sentMessages.push({ to, content, metadata })
        return 'fake-id'
      },
    } as unknown as OutboxService

    const actions: Record<string, ActionConfig> = {
      greet: { steps: [{ message: { body: 'Menu:\n1. Hours\n2. Prices\n0. Exit' } }] },
      hours: { steps: [{ message: { body: 'Open Mon-Fri 9-18h' } }] },
      prices: { steps: [{ message: { body: 'From $10/mo' } }] },
      invalid: { steps: [{ message: { body: 'Invalid option' } }] },
      farewell: { steps: [{ message: { body: 'Goodbye!' } }] },
      escalate: {
        guards: {
          cooldown: {
            duration: 30,
            on_blocked: [{ message: { body: 'Please wait, action on cooldown.' } }],
          },
        },
        steps: [{ message: { body: 'Escalating to human.' } }],
      },
      cool_reply: {
        guards: {
          cooldown: {
            duration: 30,
            on_blocked: [],
          },
        },
        steps: [{ message: { body: 'Done!' } }],
      },
      request_greet: {
        steps: [
          { message: { body: 'Request sent' } },
          { request: { url: 'https://example.com/hook', retry: 1 } },
        ],
      },
      request_fail: {
        steps: [
          { message: { body: 'Failed request' } },
          { request: { url: 'https://example.com/fail', retry: 1 } },
        ],
      },
      request_only: { steps: [{ request: { url: 'https://example.com/hook-only', retry: 1 } }] },
      send_office: {
        steps: [
          { message: { body: 'Here is our office.' } },
          {
            location: {
              latitude: 19.4326,
              longitude: -99.1332,
              name: 'Main Office',
              address: 'Av. Reforma 123',
            },
          },
        ],
      },
      send_store_only: {
        steps: [{
          location: {
            latitude: 19.4326,
            longitude: -99.1332,
            name: 'Store',
          },
        }],
      },
    }

    const graphs: Record<string, GraphConfig> = {
      'faq-menu': {
        root: 'menu',
        timeout: 300,
        fallback: 'invalid',
        nodes: {
          menu: {
            action: 'greet',
            edges: [
              { match: '1, hours', goto: 'hours' },
              { match: '2, prices', goto: 'prices' },
              { match: '3, human', goto: 'escalate' },
              { match: '0, exit', goto: 'farewell' },
              { goto: 'invalid' },
            ],
          },
          hours: {
            action: 'hours',
            edges: [
              { match: 'menu, back', goto: 'menu' },
              { goto: 'invalid' },
            ],
          },
          prices: {
            action: 'prices',
            edges: [
              { match: 'menu, back', goto: 'menu' },
              { goto: 'invalid' },
            ],
          },
          escalate: {
            action: 'escalate',
            edges: [
              { match: 'menu, back', goto: 'menu' },
              { goto: 'invalid' },
            ],
          },
          invalid: {
            action: 'invalid',
            edges: [
              { goto: 'menu' },
            ],
          },
          farewell: {
            action: 'farewell',
            edges: [],
          },
        },
      },
      'no-fallback': {
        root: 'menu',
        nodes: {
          menu: {
            action: 'greet',
            edges: [
              { match: 'pong', goto: 'end' },
            ],
          },
          end: {
            action: 'farewell',
            edges: [],
          },
        },
      },
      'has-fallback': {
        root: 'menu',
        fallback: 'fallback',
        nodes: {
          menu: {
            action: 'greet',
            edges: [
              { match: 'correct', goto: 'done' },
            ],
          },
          fallback: {
            action: 'invalid',
            edges: [
              { goto: 'menu' },
            ],
          },
          done: {
            action: 'farewell',
            edges: [],
          },
        },
      },
      'cooldown-simple': {
        root: 'start',
        nodes: {
          start: {
            action: 'cool_reply',
            edges: [],
          },
        },
      },
      'request-flow': {
        root: 'start',
        nodes: {
          start: {
            action: 'request_greet',
            edges: [],
          },
        },
      },
      'request-fail': {
        root: 'start',
        nodes: {
          start: {
            action: 'request_fail',
            edges: [],
          },
        },
      },
      'request-only': {
        root: 'start',
        nodes: {
          start: {
            action: 'request_only',
            edges: [],
          },
        },
      },
      'location-flow': {
        root: 'start',
        nodes: {
          start: {
            action: 'send_office',
            edges: [],
          },
        },
      },
      'location-only-flow': {
        root: 'start',
        nodes: {
          start: {
            action: 'send_store_only',
            edges: [],
          },
        },
      },
      'menu-and-prices': {
        root: 'menu',
        nodes: {
          menu: {
            action: 'greet',
            edges: [
              { match: '1', goto: 'hours' },
              { match: '2', goto: 'prices' },
            ],
          },
          hours: {
            action: 'hours',
            edges: [],
          },
          prices: {
            action: 'prices',
            edges: [],
          },
        },
      },
    }

    executor = new GraphExecutor(
      mapActionCatalog(actions),
      mapGraphCatalog(graphs),
      graphStateService,
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
      graph: 'faq-menu',
    }
  })

  afterEach(() => {
    graphStateService.close()
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

  it('should start a session at root on first message and execute root action', async () => {
    bot = { ...bot, graph: 'menu-and-prices' }
    const handled = await executor.handleMessage(bot, makeMessage('any first message'))

    expect(handled).toBe(true)
    expect(sentMessages).toHaveLength(1)
    expect(sentMessages[0].content).toContain('Menu:')

    const session = graphStateService.findActive('521234567890', 'support-bot')
    expect(session).not.toBeNull()
    expect(session?.nodeId).toBe('menu')
    expect(session?.variables.__visitedNodes).toEqual(['menu'])
  })

  it('should run root action AND transition to a node when first message matches an edge', async () => {
    const handled = await executor.handleMessage(bot, makeMessage('1'))

    expect(handled).toBe(true)
    expect(sentMessages).toHaveLength(2)
    expect(sentMessages[0].content).toContain('Menu:')
    expect(sentMessages[1].content).toBe('Open Mon-Fri 9-18h')

    const session = graphStateService.findActive('521234567890', 'support-bot')
    expect(session?.nodeId).toBe('hours')
  })

  it('should not transition on first message when it does not match an edge', async () => {
    bot = { ...bot, graph: 'menu-and-prices' }
    await executor.handleMessage(bot, makeMessage('something not matching'))

    expect(sentMessages).toHaveLength(1)
    expect(sentMessages[0].content).toContain('Menu:')

    const session = graphStateService.findActive('521234567890', 'support-bot')
    expect(session?.nodeId).toBe('menu')
  })

  it('should transition to next node on edge match', async () => {
    await executor.handleMessage(bot, makeMessage('1'))
    const handled = await executor.handleMessage(bot, makeMessage('back'))

    expect(handled).toBe(true)
    expect(sentMessages).toHaveLength(3)
    expect(sentMessages[2].content).toContain('Menu:')

    const session = graphStateService.findActive('521234567890', 'support-bot')
    expect(session?.nodeId).toBe('menu')
  })

  it('should use fallback node when no edge matches and fallback is configured', async () => {
    await executor.handleMessage(bot, makeMessage('1'))
    const handled = await executor.handleMessage(bot, makeMessage('random answer'))

    expect(handled).toBe(true)
    expect(sentMessages).toHaveLength(3)
    expect(sentMessages[2].content).toBe('Invalid option')

    const session = graphStateService.findActive('521234567890', 'support-bot')
    expect(session?.nodeId).toBe('invalid')
  })

  it('should keep session alive when reaching a node with no edges', async () => {
    await executor.handleMessage(bot, makeMessage('0'))

    expect(sentMessages[sentMessages.length - 1].content).toBe('Goodbye!')

    const session = graphStateService.findActive('521234567890', 'support-bot')
    expect(session).not.toBeNull()
    expect(session?.nodeId).toBe('farewell')
  })

  it('should not match when no graph is assigned to bot', async () => {
    bot = { ...bot, graph: '' }

    const handled = await executor.handleMessage(bot, makeMessage('hello'))

    expect(handled).toBe(false)
  })

  it('should not match when bot references non-existent graph', async () => {
    bot = { ...bot, graph: 'missing-graph' }

    const handled = await executor.handleMessage(bot, makeMessage('hello'))

    expect(handled).toBe(false)
  })

  it('should not match when graph root is missing from nodes', async () => {
    const catalog = (executor as any).graphCatalog
    catalog.set('bad-root', {
      id: 'bad-root',
      root: 'phantom',
      nodes: { start: { action: 'greet', edges: [] } },
    })

    bot = { ...bot, graph: 'bad-root' }
    const handled = await executor.handleMessage(bot, makeMessage('hello'))

    expect(handled).toBe(false)
  })

  describe('cooldown on actions', () => {
    it('should execute action normally when no cooldown active', async () => {
      await executor.handleMessage(bot, makeMessage('1'))
      const handled = await executor.handleMessage(bot, makeMessage('back'))

      expect(handled).toBe(true)
    })

    it('should send cooldown_reply when action on cooldown', async () => {
      bot = { ...bot, graph: 'has-fallback' }

      await executor.handleMessage(bot, makeMessage('correct'))
      expect(sentMessages[0].content).toContain('Menu:')
      expect(sentMessages[1].content).toBe('Goodbye!')

      sentMessages = []
      await executor.handleMessage(bot, makeMessage('xyzzy'))

      expect(sentMessages[0].content).toBe('Invalid option')
    })

    it('should not re-fire action on subsequent message when node has no edges', async () => {
      bot = { ...bot, graph: 'cooldown-simple' }

      const first = await executor.handleMessage(bot, makeMessage('first'))
      expect(first).toBe(true)
      expect(sentMessages[0].content).toBe('Done!')

      const second = await executor.handleMessage(bot, makeMessage('second'))
      expect(second).toBe(true)
      expect(sentMessages).toHaveLength(1)
    })

    it('should skip cooldown checks when no cooldownService set', async () => {
      const noCooldown = new GraphExecutor(
        new Map(),
        new Map(),
        graphStateService,
        outboxService,
        300
      )
      ;(noCooldown as any).actionCatalog = (executor as any).actionCatalog
      ;(noCooldown as any).graphCatalog = (executor as any).graphCatalog

      bot = { ...bot, graph: 'cooldown-simple' }

      const first = await noCooldown.handleMessage(bot, makeMessage('a'))
      expect(first).toBe(true)
      expect(sentMessages[0].content).toBe('Done!')

      const second = await noCooldown.handleMessage(bot, makeMessage('b'))
      expect(second).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should destroy session and return false when active graph not in catalog', async () => {
      graphStateService.create('521234567890', 'support-bot', 'ghost-graph', 'menu', 300)

      const handled = await executor.handleMessage(bot, makeMessage('anything'))

      expect(handled).toBe(false)
      expect(graphStateService.findActive('521234567890', 'support-bot')).toBeNull()
    })

    it('should destroy session when active node not in graph', async () => {
      graphStateService.create('521234567890', 'support-bot', 'faq-menu', 'phantom-node', 300)

      const handled = await executor.handleMessage(bot, makeMessage('anything'))

      expect(handled).toBe(false)
      expect(graphStateService.findActive('521234567890', 'support-bot')).toBeNull()
    })

    it('should return true when no edge matches and no fallback', async () => {
      bot = { ...bot, graph: 'no-fallback' }

      await executor.handleMessage(bot, makeMessage('hello'))
      expect(sentMessages[0]).toBeDefined()

      const handled = await executor.handleMessage(bot, makeMessage('xyzzy'))

      expect(handled).toBe(true)
      expect(sentMessages).toHaveLength(1)
    })

    it('should use fallback when no edge matches and no default edge', async () => {
      bot = { ...bot, graph: 'has-fallback' }

      const handled = await executor.handleMessage(bot, makeMessage('hello'))

      expect(handled).toBe(true)
      expect(sentMessages[sentMessages.length - 1].content).toBe('Invalid option')

      const session = graphStateService.findActive('521234567890', 'support-bot')
      expect(session?.nodeId).toBe('fallback')
    })

    it('should destroy session when transition targets non-existent node', async () => {
      const catalog = (executor as any).graphCatalog
      catalog.set('bad-edge', {
        id: 'bad-edge',
        root: 'menu',
        nodes: {
          menu: {
            action: 'greet',
            edges: [{ match: 'go', goto: 'missing-node' }],
          },
        },
      })

      bot = { ...bot, graph: 'bad-edge' }
      await executor.handleMessage(bot, makeMessage('hello'))
      expect(sentMessages.length).toBeGreaterThan(0)

      sentMessages = []
      const handled = await executor.handleMessage(bot, makeMessage('go'))

      expect(handled).toBe(true)
      expect(sentMessages).toHaveLength(0)
      expect(graphStateService.findActive('521234567890', 'support-bot')).toBeNull()
    })
  })

  describe('location actions', () => {
    it('should enqueue reply and location when action has both', async () => {
      bot = { ...bot, graph: 'location-flow' }

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
      bot = { ...bot, graph: 'location-only-flow' }

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

  describe('request actions', () => {
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

    it('should execute request action on root entry', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

      bot = { ...bot, graph: 'request-flow' }

      const handled = await executor.handleMessage(bot, makeMessage('hi'))

      expect(handled).toBe(true)
      expect(sentMessages[0].content).toBe('Request sent')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/hook',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should not throw when request fails', async () => {
      fetchMock.mockRejectedValue(new Error('Connection refused'))

      bot = { ...bot, graph: 'request-fail' }

      const handled = await executor.handleMessage(bot, makeMessage('hi'))

      expect(handled).toBe(true)
      expect(sentMessages[0].content).toBe('Failed request')
    })

    it('should execute request-only action without reply', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

      const defaultExec = new GraphExecutor(
        (executor as any).actionCatalog,
        (executor as any).graphCatalog,
        graphStateService,
        outboxService
      )

      bot = { ...bot, graph: 'request-only' }

      const handled = await defaultExec.handleMessage(bot, makeMessage('hi'))

      expect(handled).toBe(true)
      expect(sentMessages).toHaveLength(0)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.com/hook-only',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})
