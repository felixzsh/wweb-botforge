import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { FlowExecutor } from '../../src/flow/executor'
import { FlowStateService } from '../../src/flow/state'
import { OutboxService } from '../../src/messages/outbox'
import { CooldownService } from '../../src/action/cooldown'
import { mapActionCatalog, mapFlowCatalog } from '../../src/config/mapper'
import { Bot } from '../../src/bot'
import { IncomingMessage } from '../../src/messages/contracts'
import { ActionConfig, FlowConfig } from '../../src/config/schema'

describe('FlowExecutor', () => {
  let dbPath: string
  let flowStateService: FlowStateService
  let cooldownService: CooldownService
  let outboxService: OutboxService
  let executor: FlowExecutor
  let bot: Bot
  let sentMessages: Array<{ to: string; content: string }>

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `botforge-flow-test-${Date.now()}.db`)
    flowStateService = new FlowStateService(dbPath)
    cooldownService = new CooldownService()
    sentMessages = []
    outboxService = {
      enqueue: (_botId: string, to: string, content: string) => {
        sentMessages.push({ to, content })
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
  })
})
