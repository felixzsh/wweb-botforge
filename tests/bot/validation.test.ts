import {
  validateBotId,
  validatePriority,
  validateTypingDelay,
  validateQueueDelay,
} from '../../src/bot/validation'

describe('Validation', () => {
  describe('validateBotId', () => {
    it('should pass for valid bot ID', () => {
      expect(() => validateBotId('test-bot')).not.toThrow()
      expect(() => validateBotId('bot123')).not.toThrow()
      expect(() => validateBotId('my-awesome-bot')).not.toThrow()
    })

    it('should throw for ID too short', () => {
      expect(() => validateBotId('ab')).toThrow('Bot ID must be at least 3 characters long')
      expect(() => validateBotId('')).toThrow('Bot ID must be at least 3 characters long')
    })

    it('should throw for invalid characters', () => {
      expect(() => validateBotId('test_bot')).toThrow('Bot ID can only contain lowercase letters, numbers and hyphens')
      expect(() => validateBotId('Test-Bot')).toThrow('Bot ID can only contain lowercase letters, numbers and hyphens')
      expect(() => validateBotId('bot@name')).toThrow('Bot ID can only contain lowercase letters, numbers and hyphens')
    })

    it('should throw if ID starts with hyphen', () => {
      expect(() => validateBotId('-test')).toThrow('Bot ID cannot start with a hyphen')
    })

    it('should throw if ID ends with hyphen', () => {
      expect(() => validateBotId('test-')).toThrow('Bot ID cannot end with a hyphen')
    })

    it('should throw if ID has consecutive hyphens', () => {
      expect(() => validateBotId('test--bot')).toThrow('Bot ID cannot contain consecutive hyphens')
    })
  })

  describe('validatePriority', () => {
    it('should pass for valid priority', () => {
      expect(() => validatePriority(0)).not.toThrow()
      expect(() => validatePriority(1)).not.toThrow()
      expect(() => validatePriority(100)).not.toThrow()
    })

    it('should throw for negative priority', () => {
      expect(() => validatePriority(-1)).toThrow('Priority must be non-negative')
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
