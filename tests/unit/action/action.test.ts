import { executeAction, resolveAction, ActionExecutionContext } from '../../../src/actions/action'
import { mapActionCatalog } from '../../../src/config/mapper'
import { ActionConfig } from '../../../src/config/schema'

describe('Action', () => {
  describe('executeAction', () => {
    const context: ActionExecutionContext = {
      botId: 'bot-1',
      botName: 'Test Bot',
      sender: '521234567890',
      message: 'hello',
      variables: { name: 'Felix' },
    }

    it('should resolve reply text with variables', () => {
      const config: Record<string, ActionConfig> = {
        greet: { reply: 'Hi {{sender}}, welcome {{variables.name}}!' },
      }
      const catalog = mapActionCatalog(config)

      const result = executeAction(catalog, 'greet', context)

      expect(result.reply).toBe('Hi 521234567890, welcome Felix!')
    })

    it('should resolve webhook url with variables', () => {
      const config: Record<string, ActionConfig> = {
        track: {
          webhook: {
            url: 'https://api.example.com/users/{{sender}}',
          },
        },
      }
      const catalog = mapActionCatalog(config)

      const result = executeAction(catalog, 'track', context)

      expect(result.webhook?.url).toBe('https://api.example.com/users/521234567890')
    })

    it('should resolve composite actions', () => {
      const config: Record<string, ActionConfig> = {
        escalate: {
          reply: 'Escalating for {{variables.name}}',
          webhook: {
            url: 'https://api.example.com/escalate',
          },
        },
      }
      const catalog = mapActionCatalog(config)

      const result = executeAction(catalog, 'escalate', context)

      expect(result.reply).toBe('Escalating for Felix')
      expect(result.webhook?.url).toBe('https://api.example.com/escalate')
    })

    it('should resolve senderName when provided', () => {
      const config: Record<string, ActionConfig> = {
        greet: { reply: 'Hi {{senderName}}!' },
      }
      const catalog = mapActionCatalog(config)
      const ctx: ActionExecutionContext = { ...context, senderName: 'Marcos' }

      const result = executeAction(catalog, 'greet', ctx)

      expect(result.reply).toBe('Hi Marcos!')
    })

    it('should fallback senderName to sender when senderName is missing', () => {
      const config: Record<string, ActionConfig> = {
        greet: { reply: 'Hi {{senderName}}!' },
      }
      const catalog = mapActionCatalog(config)

      const result = executeAction(catalog, 'greet', context)

      expect(result.reply).toBe('Hi 521234567890!')
    })

    it('should resolve missing variable as empty string', () => {
      const config: Record<string, ActionConfig> = {
        greet: { reply: 'Hello {{variables.unknown}}!' },
      }
      const catalog = mapActionCatalog(config)

      const result = executeAction(catalog, 'greet', context)

      expect(result.reply).toBe('Hello !')
    })

    it('should throw for unknown action', () => {
      const catalog = mapActionCatalog({})

      expect(() => executeAction(catalog, 'missing', context)).toThrow('Action "missing" not found in catalog')
    })

    it('should resolve location-only action', () => {
      const config: Record<string, ActionConfig> = {
        send_location: {
          location: {
            latitude: 19.4326,
            longitude: -99.1332,
            name: 'Office',
          },
        },
      }
      const catalog = mapActionCatalog(config)

      const result = executeAction(catalog, 'send_location', context)

      expect(result.reply).toBeUndefined()
      expect(result.webhook).toBeUndefined()
      expect(result.location).toEqual({
        latitude: 19.4326,
        longitude: -99.1332,
        name: 'Office',
      })
    })

    it('should resolve composite action with reply and location', () => {
      const config: Record<string, ActionConfig> = {
        send_office: {
          reply: 'Here is our office.',
          location: {
            latitude: 19.4326,
            longitude: -99.1332,
            name: 'Main Office',
            address: 'Av. Reforma 123',
            url: 'https://maps.example.com/office',
            description: 'Open Mon-Fri 9-18h',
          },
        },
      }
      const catalog = mapActionCatalog(config)

      const result = executeAction(catalog, 'send_office', context)

      expect(result.reply).toBe('Here is our office.')
      expect(result.location?.latitude).toBe(19.4326)
      expect(result.location?.longitude).toBe(-99.1332)
      expect(result.location?.name).toBe('Main Office')
      expect(result.location?.address).toBe('Av. Reforma 123')
      expect(result.location?.url).toBe('https://maps.example.com/office')
      expect(result.location?.description).toBe('Open Mon-Fri 9-18h')
    })
  })

  describe('resolveAction', () => {
    it('should return action by id', () => {
      const config: Record<string, ActionConfig> = {
        greet: { reply: 'Hello!' },
      }
      const catalog = mapActionCatalog(config)

      const action = resolveAction(catalog, 'greet')
      expect(action.reply).toBe('Hello!')
    })

    it('should throw if action is not found', () => {
      const catalog = mapActionCatalog({})

      expect(() => resolveAction(catalog, 'missing')).toThrow('Action "missing" not found in catalog')
    })
  })
})
