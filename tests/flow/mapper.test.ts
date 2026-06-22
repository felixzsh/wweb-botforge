import { mapFlowCatalog } from '../../src/config/mapper'
import { FlowConfig } from '../../src/config/schema'

describe('FlowMapper', () => {
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

  it('should throw if entry step does not exist', () => {
    const config: Record<string, FlowConfig> = {
      broken: {
        entry_step: 'missing',
        steps: {},
      },
    }

    expect(() => mapFlowCatalog(config)).toThrow('Flow "broken" entry step "missing" not found')
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
