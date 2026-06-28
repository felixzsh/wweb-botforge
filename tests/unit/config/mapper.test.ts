import { mapActionCatalog, mapFlowCatalog, mapConfigToBot, mapSettings, mapBotsFromConfig } from '../../../src/config/mapper'
import { BotConfig, BotSettingsConfig, ActionConfig, FlowConfig } from '../../../src/config/schema'

describe('Mapper', () => {
  describe('mapActionCatalog', () => {
    it('should map simple reply actions', () => {
      const config: Record<string, ActionConfig> = {
        greet: { reply: 'Hello!' },
      }

      const catalog = mapActionCatalog(config)

      expect(catalog.has('greet')).toBe(true)
      expect(catalog.get('greet')?.reply).toBe('Hello!')
    })

    it('should map webhook actions with defaults', () => {
      const config: Record<string, ActionConfig> = {
        notify: {
          webhook: {
            url: 'https://example.com/notify',
          },
        },
      }

      const catalog = mapActionCatalog(config)

      const action = catalog.get('notify')
      expect(action?.webhook?.url).toBe('https://example.com/notify')
      expect(action?.webhook?.method).toBe('POST')
      expect(action?.webhook?.timeout).toBe(5000)
      expect(action?.webhook?.retries).toBe(3)
      expect(action?.webhook?.headers).toEqual({})
    })

    it('should map composite actions with reply and webhook', () => {
      const config: Record<string, ActionConfig> = {
        escalate: {
          reply: 'Connecting you to a human.',
          webhook: {
            name: 'escalate',
            url: 'https://example.com/escalate',
            method: 'POST',
            headers: { Authorization: 'Bearer token' },
            timeout: 10000,
            retry: 5,
          },
        },
      }

      const catalog = mapActionCatalog(config)

      const action = catalog.get('escalate')
      expect(action?.reply).toBe('Connecting you to a human.')
      expect(action?.webhook?.name).toBe('escalate')
      expect(action?.webhook?.retries).toBe(5)
    })

    it('should throw if action has neither reply nor webhook nor location', () => {
      const config: Record<string, ActionConfig> = {
        empty: {},
      }

      expect(() => mapActionCatalog(config)).toThrow('Action "empty" must define reply, webhook, location, or a combination')
    })

    it('should map location-only actions', () => {
      const config: Record<string, ActionConfig> = {
        send_store: {
          location: {
            latitude: 19.4326,
            longitude: -99.1332,
            name: 'Store',
            address: 'Reforma 123',
            url: 'https://maps.example.com/store',
            description: 'Open Mon-Fri',
          },
        },
      }

      const catalog = mapActionCatalog(config)

      const action = catalog.get('send_store')
      expect(action?.reply).toBeUndefined()
      expect(action?.webhook).toBeUndefined()
      expect(action?.location).toEqual({
        latitude: 19.4326,
        longitude: -99.1332,
        name: 'Store',
        address: 'Reforma 123',
        url: 'https://maps.example.com/store',
        description: 'Open Mon-Fri',
      })
    })

    it('should map composite actions with reply and location', () => {
      const config: Record<string, ActionConfig> = {
        send_office: {
          reply: 'Here is our office.',
          location: {
            latitude: 19.4326,
            longitude: -99.1332,
          },
        },
      }

      const catalog = mapActionCatalog(config)

      const action = catalog.get('send_office')
      expect(action?.reply).toBe('Here is our office.')
      expect(action?.location?.latitude).toBe(19.4326)
      expect(action?.location?.longitude).toBe(-99.1332)
    })
  })

  describe('mapSettings', () => {
    it('should map settings with default values', () => {
      const config: BotSettingsConfig = {}
      const settings = mapSettings(config)

      expect(settings.simulateTyping).toBe(true)
      expect(settings.typingDelay).toBe(1000)
      expect(settings.queueDelay).toBe(1000)
      expect(settings.readReceipts).toBe(true)
      expect(settings.ignoreGroups).toBe(true)
      expect(settings.ignoredSenders).toEqual([])
      expect(settings.adminNumbers).toEqual([])
    })

    it('should map settings with custom values', () => {
      const config: BotSettingsConfig = {
        simulate_typing: false,
        typing_delay: 500,
        queue_delay: 2000,
        read_receipts: false,
        ignore_groups: false,
        ignored_senders: ['1111111111', '2222222222'],
        admin_numbers: ['9999999999'],
      }

      const settings = mapSettings(config)

      expect(settings.simulateTyping).toBe(false)
      expect(settings.typingDelay).toBe(500)
      expect(settings.queueDelay).toBe(2000)
      expect(settings.readReceipts).toBe(false)
      expect(settings.ignoreGroups).toBe(false)
      expect(settings.ignoredSenders).toEqual(['1111111111', '2222222222'])
      expect(settings.adminNumbers).toEqual(['9999999999'])
    })
  })

  describe('mapConfigToBot', () => {
    it('should map minimal bot configuration', () => {
      const bot = mapConfigToBot('test-bot', {})

      expect(bot.id).toBe('test-bot')
    })

    it('should map bot with flows', () => {
      const bot = mapConfigToBot('flow-bot', {
        flows: [{ id: 'faq-menu', priority: 5 }],
      })

      expect(bot.flows).toHaveLength(1)
      expect(bot.flows[0].id).toBe('faq-menu')
      expect(bot.flows[0].priority).toBe(5)
    })

    it('should map complete bot configuration', () => {
      const bot = mapConfigToBot('complete-bot', {
        flows: [{ id: 'faq-menu', priority: 10 }],
        settings: {
          simulate_typing: true,
          typing_delay: 1500,
          queue_delay: 1000,
          read_receipts: true,
          ignore_groups: false,
          ignored_senders: ['spam@broadcast'],
          admin_numbers: ['9999999999'],
        },
      })

      expect(bot.id).toBe('complete-bot')
      expect(bot.flows).toHaveLength(1)
      expect(bot.settings.ignoreGroups).toBe(false)
    })

    it('should throw error for invalid bot ID', () => {
      expect(() => mapConfigToBot('ab', {})).toThrow('Bot ID must be at least 3 characters long')
    })

    it('should throw error for empty bot name', () => {
      expect(() => mapConfigToBot('', {})).toThrow('Bot ID must be at least 3 characters long')
    })
  })

  describe('mapBotsFromConfig', () => {
    it('should map multiple bot configurations', () => {
      const configs: Record<string, BotConfig> = {
        'bot-1': {},
        'bot-2': {},
        'bot-3': {},
      }

      const bots = mapBotsFromConfig(configs)

      expect(bots).toHaveLength(3)
      expect(bots[0].id).toBe('bot-1')
      expect(bots[1].id).toBe('bot-2')
      expect(bots[2].id).toBe('bot-3')
    })

    it('should return empty array for empty input', () => {
      const bots = mapBotsFromConfig({})
      expect(bots).toHaveLength(0)
    })
  })

  describe('mapFlowCatalog', () => {
    it('should map a simple flow with triggers and branches', () => {
      const config: Record<string, FlowConfig> = {
        'faq-menu': {
          entry_step: 'menu',
          triggers: 'menu, hola',
          timeout: 300,
          fallback_step: 'invalid',
          steps: {
            menu: {
              action: 'greet',
              branches: [
                { when: '1, horario', goto: 'hours' },
                { when: '2, precio', goto: 'prices' },
                { goto: 'invalid' },
              ],
            },
            hours: {
              action: 'hours-info',
              branches: [
                { when: 'menu, volver', goto: 'menu' },
              ],
            },
            prices: {
              action: 'prices-info',
              branches: [],
            },
            invalid: {
              action: 'invalid-option',
              branches: [
                { goto: 'menu' },
              ],
            },
          },
        },
      }

      const catalog = mapFlowCatalog(config)
      const flow = catalog.get('faq-menu')

      expect(flow).toBeDefined()
      expect(flow?.entryStep).toBe('menu')
      expect(flow?.triggers?.[0].phrases).toEqual(['menu', 'hola'])
      expect(flow?.timeout).toBe(300)
      expect(flow?.fallbackStep).toBe('invalid')

      expect(flow?.steps.menu.action).toBe('greet')
      expect(flow?.steps.menu.branches).toHaveLength(3)
      expect(flow?.steps.menu.branches[0].goto).toBe('hours')
      expect(flow?.steps.menu.branches[2].when).toBeUndefined()

      expect(flow?.steps.prices.branches).toHaveLength(0)
    })

    it('should support structured triggers', () => {
      const config: Record<string, FlowConfig> = {
        test: {
          entry_step: 'start',
          triggers: [{ phrases: 'hola, hi', fuzzy_threshold: 0.4 }],
          steps: {
            start: {
              action: 'greet',
              branches: [],
            },
          },
        },
      }

      const catalog = mapFlowCatalog(config)
      const flow = catalog.get('test')

      expect(flow?.triggers?.[0].fuzzyThreshold).toBe(0.4)
      expect(flow?.triggers?.[0].phrases).toEqual(['hola', 'hi'])
    })

    it('should handle empty triggers array', () => {
      const config: Record<string, FlowConfig> = {
        test: {
          entry_step: 'start',
          triggers: [],
          steps: {
            start: {
              action: 'greet',
              branches: [],
            },
          },
        },
      }

      const catalog = mapFlowCatalog(config)
      const flow = catalog.get('test')

      expect(flow?.triggers).toHaveLength(0)
    })

    it('should handle triggers as string array', () => {
      const config: Record<string, FlowConfig> = {
        test: {
          entry_step: 'start',
          triggers: ['hello', 'hi'],
          steps: {
            start: {
              action: 'greet',
              branches: [],
            },
          },
        },
      }

      const catalog = mapFlowCatalog(config)
      const flow = catalog.get('test')

      expect(flow?.triggers).toHaveLength(2)
      expect(flow?.triggers?.[0].phrases).toEqual(['hello'])
      expect(flow?.triggers?.[1].phrases).toEqual(['hi'])
    })

    it('should handle branch with when as string array', () => {
      const config: Record<string, FlowConfig> = {
        test: {
          entry_step: 'start',
          steps: {
            start: {
              action: 'greet',
              branches: [
                { when: ['1', 'one'], goto: 'option1' },
              ],
            },
            option1: {
              action: 'greet',
              branches: [],
            },
          },
        },
      }

      const catalog = mapFlowCatalog(config)
      const flow = catalog.get('test')

      expect(flow?.steps.start.branches[0].when).toEqual(['1', 'one'])
    })

    it('should handle step without branches field', () => {
      const config: Record<string, FlowConfig> = {
        test: {
          entry_step: 'start',
          steps: {
            start: {
              action: 'greet',
            },
          },
        },
      }

      const catalog = mapFlowCatalog(config)
      const flow = catalog.get('test')

      expect(flow?.steps.start.branches).toEqual([])
    })

    it('should handle structured triggers with phrases as array', () => {
      const config: Record<string, FlowConfig> = {
        test: {
          entry_step: 'start',
          triggers: [{ phrases: ['hola', 'hi'], fuzzy_threshold: 0.4 }],
          steps: {
            start: {
              action: 'greet',
              branches: [],
            },
          },
        },
      }

      const catalog = mapFlowCatalog(config)
      const flow = catalog.get('test')

      expect(flow?.triggers?.[0].fuzzyThreshold).toBe(0.4)
      expect(flow?.triggers?.[0].phrases).toEqual(['hola', 'hi'])
    })

    it('should throw if entry step does not exist', () => {
      const config: Record<string, FlowConfig> = {
        broken: {
          entry_step: 'missing',
          steps: {},
        },
      }

      expect(() => mapFlowCatalog(config)).toThrow('Flow "broken" entry step "missing" not found')
    })

    it('should throw if fallback step does not exist', () => {
      const config: Record<string, FlowConfig> = {
        broken: {
          entry_step: 'start',
          fallback_step: 'missing',
          steps: {
            start: {
              action: 'greet',
              branches: [],
            },
          },
        },
      }

      expect(() => mapFlowCatalog(config)).toThrow('Flow "broken" fallback step "missing" not found')
    })
  })
})
