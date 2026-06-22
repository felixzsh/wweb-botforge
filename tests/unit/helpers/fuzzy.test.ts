import { matchFuzzy } from '../../../src/helpers/fuzzy'

describe('matchFuzzy', () => {
  it('should return null for empty segments array', () => {
    const result = matchFuzzy([], 'hello', 0.6)
    expect(result).toBeNull()
  })

  it('should return match when message matches a segment', () => {
    const result = matchFuzzy(['hello', 'world'], 'hello', 0.6)
    expect(result).toBe('hello')
  })

  it('should return null when no match found', () => {
    const result = matchFuzzy(['hello', 'world'], 'xyz', 0.1)
    expect(result).toBeNull()
  })
})
