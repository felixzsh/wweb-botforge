import {
  normalizePhoneNumber,
  extractPhoneNumberFromWid,
  widToPhoneNumber,
  phoneNumberToWid,
  isMediaMessage,
  isInteractiveMessage,
  getFileExtension,
  generateMessageId,
  toDomainMessage,
  toWhatsAppFormat,
  WhatsAppMessageType,
} from '../../../src/whatsapp/whatsapp'

describe('WhatsApp conversion helpers', () => {
  describe('normalizePhoneNumber', () => {
    it('should remove non-digit characters', () => {
      expect(normalizePhoneNumber('+52 123 456 7890')).toBe('521234567890')
      expect(normalizePhoneNumber('(555) 123-4567')).toBe('5551234567')
    })

    it('should return empty string for empty input', () => {
      expect(normalizePhoneNumber('')).toBe('')
    })
  })

  describe('extractPhoneNumberFromWid', () => {
    it('should extract number from WID', () => {
      expect(extractPhoneNumberFromWid('521234567890@c.us')).toBe('521234567890')
      expect(extractPhoneNumberFromWid('12345@g.us')).toBe('12345')
    })

    it('should return original string if no match', () => {
      expect(extractPhoneNumberFromWid('no-at-sign')).toBe('no-at-sign')
    })
  })

  describe('widToPhoneNumber', () => {
    it('should convert WID to clean phone number', () => {
      expect(widToPhoneNumber('+52 1234 5678@c.us')).toBe('5212345678')
    })
  })

  describe('phoneNumberToWid', () => {
    it('should convert phone number to WID format', () => {
      expect(phoneNumberToWid('521234567890')).toBe('521234567890@c.us')
    })

    it('should normalize phone number before conversion', () => {
      expect(phoneNumberToWid('+52 123 456 7890')).toBe('521234567890@c.us')
    })
  })

  describe('isMediaMessage', () => {
    it('should return true for media types', () => {
      expect(isMediaMessage(WhatsAppMessageType.IMAGE)).toBe(true)
      expect(isMediaMessage(WhatsAppMessageType.VIDEO)).toBe(true)
      expect(isMediaMessage(WhatsAppMessageType.AUDIO)).toBe(true)
      expect(isMediaMessage(WhatsAppMessageType.DOCUMENT)).toBe(true)
      expect(isMediaMessage(WhatsAppMessageType.STICKER)).toBe(true)
    })

    it('should return false for text', () => {
      expect(isMediaMessage(WhatsAppMessageType.TEXT)).toBe(false)
    })
  })

  describe('isInteractiveMessage', () => {
    it('should return true for interactive types', () => {
      expect(isInteractiveMessage(WhatsAppMessageType.BUTTONS_RESPONSE)).toBe(true)
      expect(isInteractiveMessage(WhatsAppMessageType.LIST_RESPONSE)).toBe(true)
      expect(isInteractiveMessage(WhatsAppMessageType.TEMPLATE_BUTTON_REPLY)).toBe(true)
    })

    it('should return false for text', () => {
      expect(isInteractiveMessage(WhatsAppMessageType.TEXT)).toBe(false)
    })
  })

  describe('getFileExtension', () => {
    it('should return extension for known MIME types', () => {
      expect(getFileExtension('image/jpeg')).toBe('jpg')
      expect(getFileExtension('image/png')).toBe('png')
      expect(getFileExtension('application/pdf')).toBe('pdf')
    })

    it('should return bin for unknown MIME types', () => {
      expect(getFileExtension('application/octet-stream')).toBe('bin')
    })
  })

  describe('generateMessageId', () => {
    it('should generate a non-empty string', () => {
      const id = generateMessageId()
      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
      expect(id).toContain('-')
    })

    it('should generate unique ids', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateMessageId()))
      expect(ids.size).toBe(100)
    })
  })

  describe('toDomainMessage', () => {
    it('should convert WWebJS message to domain message', () => {
      const msg = {
        id: { _serialized: 'test-id-123' },
        from: '521234567890@c.us',
        to: '5210987654321@c.us',
        body: 'Hello there!',
        timestamp: 1000,
        hasMedia: false,
        type: 'chat',
        fromMe: false,
        isGroupMsg: false,
      } as any

      const result = toDomainMessage(msg)

      expect(result.id).toBe('test-id-123')
      expect(result.from).toBe('521234567890')
      expect(result.to).toBe('5210987654321')
      expect(result.content).toBe('Hello there!')
      expect(result.timestamp).toBeInstanceOf(Date)
      expect(result.metadata?.fromMe).toBe(false)
      expect(result.metadata?.isGroup).toBe(false)
    })

    it('should set isGroup to false when isGroupMsg is undefined', () => {
      const msg = {
        id: { _serialized: 'test' },
        from: '123@c.us',
        to: '456@c.us',
        body: 'test',
        timestamp: 0,
        hasMedia: false,
        type: 'chat',
        fromMe: false,
      } as any

      const result = toDomainMessage(msg)
      expect(result.metadata?.isGroup).toBe(false)
    })
  })

  describe('toWhatsAppFormat', () => {
    it('should convert domain message to WhatsApp format', () => {
      const result = toWhatsAppFormat({
        to: '521234567890',
        content: 'Hello!',
        metadata: { linkPreview: true },
      })

      expect(result.to).toBe('521234567890@c.us')
      expect(result.content).toBe('Hello!')
      expect(result.options).toEqual({ linkPreview: true })
    })

    it('should handle missing metadata', () => {
      const result = toWhatsAppFormat({
        to: '521234567890',
        content: 'Hello!',
      })

      expect(result.to).toBe('521234567890@c.us')
      expect(result.options).toBeUndefined()
    })
  })
})
