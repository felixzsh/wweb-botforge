import { mapActionCatalog, resolveAction } from '../../src/action/catalog'
import { ActionConfig } from '../../src/bot/types'

describe('ActionCatalog', () => {
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

    it('should throw if action has neither reply nor webhook', () => {
      const config: Record<string, ActionConfig> = {
        empty: {},
      }

      expect(() => mapActionCatalog(config)).toThrow('Action "empty" must define reply, webhook, or both')
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
