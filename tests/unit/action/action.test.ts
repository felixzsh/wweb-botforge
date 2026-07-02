import { resolveAction, resolveVars, ActionExecutionContext } from '../../../src/actions/action'
import { mapActionCatalog } from '../../../src/config/mapper'
import { ActionConfig } from '../../../src/config/schema'

describe('Action', () => {
  describe('resolveVars', () => {
    const context: ActionExecutionContext = {
      botId: 'bot-1',
      botName: 'Test Bot',
      sender: '521234567890',
      message: 'hello',
      variables: { name: 'Felix' },
    }

    it('should resolve {{sender}}', () => {
      expect(resolveVars('Hi {{sender}}!', context)).toBe('Hi 521234567890!')
    })

    it('should resolve {{variables.name}}', () => {
      expect(resolveVars('Welcome {{variables.name}}!', context)).toBe('Welcome Felix!')
    })

    it('should resolve {{bot.id}}', () => {
      expect(resolveVars('Bot: {{bot.id}}', context)).toBe('Bot: bot-1')
    })

    it('should resolve {{senderName}} when provided', () => {
      const ctx: ActionExecutionContext = { ...context, senderName: 'Marcos' }
      expect(resolveVars('Hi {{senderName}}!', ctx)).toBe('Hi Marcos!')
    })

    it('should fallback senderName to sender when senderName is missing', () => {
      expect(resolveVars('Hi {{senderName}}!', context)).toBe('Hi 521234567890!')
    })

    it('should resolve missing variable as empty string', () => {
      expect(resolveVars('Hello {{variables.unknown}}!', context)).toBe('Hello !')
    })
  })

  describe('mapActionCatalog with pipeline steps', () => {
    it('should map a simple message step', () => {
      const config: Record<string, ActionConfig> = {
        greet: { steps: [{ message: { text: 'Hello!' } }] },
      }
      const catalog = mapActionCatalog(config)
      const action = catalog.get('greet')!

      expect(action.steps).toHaveLength(1)
      expect('message' in action.steps[0]).toBe(true)
      expect((action.steps[0] as any).message.text).toBe('Hello!')
    })

    it('should map a request step', () => {
      const config: Record<string, ActionConfig> = {
        track: { steps: [{ request: { url: 'https://api.example.com/hook' } }] },
      }
      const catalog = mapActionCatalog(config)
      const action = catalog.get('track')!

      expect(action.steps).toHaveLength(1)
      expect('request' in action.steps[0]).toBe(true)
      expect((action.steps[0] as any).request.url).toBe('https://api.example.com/hook')
    })

    it('should map a location step', () => {
      const config: Record<string, ActionConfig> = {
        send_location: {
          steps: [{
            location: {
              latitude: 19.4326,
              longitude: -99.1332,
              name: 'Office',
            },
          }],
        },
      }
      const catalog = mapActionCatalog(config)
      const action = catalog.get('send_location')!

      expect(action.steps).toHaveLength(1)
      expect('location' in action.steps[0]).toBe(true)
      expect((action.steps[0] as any).location.name).toBe('Office')
    })

    it('should map multi-step pipeline (message + location)', () => {
      const config: Record<string, ActionConfig> = {
        send_office: {
          steps: [
            { message: { text: 'Here is our office.' } },
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
      }
      const catalog = mapActionCatalog(config)
      const action = catalog.get('send_office')!

      expect(action.steps).toHaveLength(2)
      expect('message' in action.steps[0]).toBe(true)
      expect('location' in action.steps[1]).toBe(true)
    })

    it('should map a cooldown guard with on_blocked pipeline', () => {
      const config: Record<string, ActionConfig> = {
        escalate: {
          guards: {
            cooldown: {
              duration: 120,
              on_blocked: [
                { message: { text: 'You already requested this. Please wait.' } },
              ],
            },
          },
          steps: [
            { message: { text: 'Escalating...' } },
            { request: { url: 'https://api.example.com/escalate' } },
          ],
        },
      }
      const catalog = mapActionCatalog(config)
      const action = catalog.get('escalate')!

      expect(action.guards?.cooldown?.duration).toBe(120)
      expect(action.guards?.cooldown?.onBlocked).toHaveLength(1)
      expect('message' in action.guards!.cooldown!.onBlocked![0]).toBe(true)
      expect(action.steps).toHaveLength(2)
    })

    it('should throw when action has no steps and no on_blocked', () => {
      const config: Record<string, ActionConfig> = {
        broken: { guards: { cooldown: { duration: 30 } } },
      }

      expect(() => mapActionCatalog(config)).toThrow(
        'Action "broken" must define steps or a cooldown guard with on_blocked'
      )
    })

    it('should throw for empty action', () => {
      const config: Record<string, ActionConfig> = {
        broken: {},
      }

      expect(() => mapActionCatalog(config)).toThrow(
        'Action "broken" must define steps or a cooldown guard with on_blocked'
      )
    })
  })

  describe('resolveAction', () => {
    it('should return action by id', () => {
      const config: Record<string, ActionConfig> = {
        greet: { steps: [{ message: { text: 'Hello!' } }] },
      }
      const catalog = mapActionCatalog(config)

      const action = resolveAction(catalog, 'greet')
      expect(action.steps).toHaveLength(1)
    })

    it('should throw if action is not found', () => {
      const catalog = mapActionCatalog({})

      expect(() => resolveAction(catalog, 'missing')).toThrow('Action "missing" not found in catalog')
    })
  })
})
