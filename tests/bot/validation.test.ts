import {
  validateBotId,
  validatePhoneNumber,
  validateBotName,
  validatePriority,
  validateResponse,
  validateWebhookUrl,
  validateWebhookName,
  validateTypingDelay,
  validateQueueDelay,
  validateMessageContent,
  validateRecipient,
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

  describe('validateResponse', () => {
    it('should pass for valid response', () => {
      expect(() => validateResponse('Hello!')).not.toThrow()
    })

    it('should throw for empty response', () => {
      expect(() => validateResponse('')).toThrow('Response cannot be empty')
      expect(() => validateResponse('   ')).toThrow('Response cannot be empty')
    })
  })

  describe('validateWebhookUrl', () => {
    it('should pass for valid URL', () => {
      expect(() => validateWebhookUrl('https://example.com')).not.toThrow()
    })

    it('should throw for empty URL', () => {
      expect(() => validateWebhookUrl('')).toThrow('Webhook URL cannot be empty')
      expect(() => validateWebhookUrl('   ')).toThrow('Webhook URL cannot be empty')
    })
  })

  describe('validateWebhookName', () => {
    it('should pass for valid name', () => {
      expect(() => validateWebhookName('my-webhook')).not.toThrow()
    })

    it('should throw for empty name', () => {
      expect(() => validateWebhookName('')).toThrow('Webhook name cannot be empty')
      expect(() => validateWebhookName('   ')).toThrow('Webhook name cannot be empty')
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

  describe('validateMessageContent', () => {
    it('should pass for valid content', () => {
      expect(() => validateMessageContent('Hello!')).not.toThrow()
    })

    it('should throw for empty content', () => {
      expect(() => validateMessageContent('')).toThrow('Message content cannot be empty')
      expect(() => validateMessageContent('   ')).toThrow('Message content cannot be empty')
    })
  })

  describe('validateRecipient', () => {
    it('should pass for valid recipient', () => {
      expect(() => validateRecipient('1234567890')).not.toThrow()
    })

    it('should throw for empty recipient', () => {
      expect(() => validateRecipient('')).toThrow('Recipient (to) cannot be empty')
      expect(() => validateRecipient('   ')).toThrow('Recipient (to) cannot be empty')
    })
  })
})
