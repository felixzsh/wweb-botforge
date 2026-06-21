import {
  validateBotId,
  validatePhoneNumber,
  validateBotName,
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
  })

  describe('validatePhoneNumber', () => {
    it('should return true for valid phone numbers', () => {
      expect(validatePhoneNumber('1234567890')).toBe(true)
      expect(validatePhoneNumber('521234567890')).toBe(true)
      expect(validatePhoneNumber('123456789012345')).toBe(true)
    })

    it('should return false for invalid phone numbers', () => {
      expect(validatePhoneNumber('12345')).toBe(false)
      expect(validatePhoneNumber('+521234567890')).toBe(false)
      expect(validatePhoneNumber('invalid')).toBe(false)
    })
  })

  describe('validateBotName', () => {
    it('should pass for valid bot name', () => {
      expect(() => validateBotName('Test Bot')).not.toThrow()
      expect(() => validateBotName('MyBot')).not.toThrow()
    })

    it('should throw for empty name', () => {
      expect(() => validateBotName('')).toThrow('Bot name cannot be empty')
      expect(() => validateBotName('   ')).toThrow('Bot name cannot be empty')
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
