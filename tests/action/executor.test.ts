import { executeAction } from '../../src/action/action'
import { mapActionCatalog } from '../../src/config/mapper'
import { ActionExecutionContext } from '../../src/action/action'
import { ActionConfig } from '../../src/config/schema'

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
})
