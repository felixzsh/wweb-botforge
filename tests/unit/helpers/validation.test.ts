import {
  validateId,
  validateTypingDelay,
  validateQueueDelay,
} from '../../../src/config/validation'

describe('Validation', () => {
  describe('validateId', () => {
    it('should pass for valid ID', () => {
      expect(() => validateId('test-bot', 'Bot')).not.toThrow()
      expect(() => validateId('bot123', 'Bot')).not.toThrow()
      expect(() => validateId('my-awesome-bot', 'Bot')).not.toThrow()
    })

    it('should throw for ID too short', () => {
      expect(() => validateId('ab', 'Bot')).toThrow('Bot ID must be at least 3 characters long')
      expect(() => validateId('', 'Bot')).toThrow('Bot ID must be at least 3 characters long')
    })

    it('should throw for invalid characters', () => {
      expect(() => validateId('test_bot', 'Bot')).toThrow('Bot ID can only contain lowercase letters, numbers and hyphens')
      expect(() => validateId('Test-Bot', 'Bot')).toThrow('Bot ID can only contain lowercase letters, numbers and hyphens')
      expect(() => validateId('bot@name', 'Bot')).toThrow('Bot ID can only contain lowercase letters, numbers and hyphens')
    })

    it('should throw if ID starts with hyphen', () => {
      expect(() => validateId('-test', 'Bot')).toThrow('Bot ID cannot start with a hyphen')
    })

    it('should throw if ID ends with hyphen', () => {
      expect(() => validateId('test-', 'Bot')).toThrow('Bot ID cannot end with a hyphen')
    })

    it('should throw if ID has consecutive hyphens', () => {
      expect(() => validateId('test--bot', 'Bot')).toThrow('Bot ID cannot contain consecutive hyphens')
    })

    it('should use the kind argument in error messages', () => {
      expect(() => validateId('ab', 'Action')).toThrow('Action ID must be at least 3 characters long')
      expect(() => validateId('Test', 'Graph')).toThrow('Graph ID can only contain lowercase letters, numbers and hyphens')
    })
  })

  describe('validateTypingDelay', () => {
    it('should pass for valid delay', () => {
      expect(() => validateTypingDelay(0)).not.toThrow()
      expect(() => validateTypingDelay(1000)).not.toThrow()
    })

    it('should throw for negative delay', () => {
      expect(() => validateTypingDelay(-1)).toThrow('Typing delay must be non-negative')
    })
  })

  describe('validateQueueDelay', () => {
    it('should pass for valid delay', () => {
      expect(() => validateQueueDelay(0)).not.toThrow()
      expect(() => validateQueueDelay(2000)).not.toThrow()
    })

    it('should throw for negative delay', () => {
      expect(() => validateQueueDelay(-1)).toThrow('Queue delay must be non-negative')
    })
  })
})
