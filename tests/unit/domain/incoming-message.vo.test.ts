import { IncomingMessage } from '../../../src/core/domain/value-objects/incoming-message.vo';
import { PhoneNumber } from '../../../src/core/domain/value-objects/phone-number.vo';

describe('IncomingMessage', () => {
  let fromPhone: PhoneNumber;
  let toPhone: PhoneNumber;

  beforeEach(() => {
    fromPhone = new PhoneNumber('5521234567890');
    toPhone = new PhoneNumber('5587654321098');
  });

  describe('create', () => {
    it('should create a valid IncomingMessage', () => {
      const message = IncomingMessage.create(
        'msg-1',
        fromPhone,
        toPhone,
        'Hello world',
        new Date(),
        { fromMe: false }
      );

      expect(message.id).toBe('msg-1');
      expect(message.from).toBe(fromPhone);
      expect(message.to).toBe(toPhone);
      expect(message.content).toBe('Hello world');
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.metadata).toEqual({ fromMe: false });
    });

    it('should throw error for empty content', () => {
      expect(() =>
        IncomingMessage.create('msg-1', fromPhone, toPhone, '', new Date())
      ).toThrow('Message content cannot be empty');
    });

    it('should throw error for whitespace-only content', () => {
      expect(() =>
        IncomingMessage.create('msg-1', fromPhone, toPhone, '   ', new Date())
      ).toThrow('Message content cannot be empty');
    });

    it('should create message without metadata', () => {
      const message = IncomingMessage.create(
        'msg-1',
        fromPhone,
        toPhone,
        'Hello',
        new Date()
      );

      expect(message.metadata).toBeUndefined();
    });
  });

  describe('getters', () => {
    let message: IncomingMessage;

    beforeEach(() => {
      const now = new Date();
      message = IncomingMessage.create(
        'msg-123',
        fromPhone,
        toPhone,
        'Test message',
        now,
        { fromMe: false, isGroup: false }
      );
    });

    it('should return id', () => {
      expect(message.id).toBe('msg-123');
    });

    it('should return from phone', () => {
      expect(message.from).toBe(fromPhone);
    });

    it('should return to phone', () => {
      expect(message.to).toBe(toPhone);
    });

    it('should return content', () => {
      expect(message.content).toBe('Test message');
    });

    it('should return timestamp', () => {
      const now = new Date();
      const msg = IncomingMessage.create(
        'msg-1',
        fromPhone,
        toPhone,
        'Test',
        now
      );
      expect(msg.timestamp).toBe(now);
    });

    it('should return metadata', () => {
      expect(message.metadata).toEqual({ fromMe: false, isGroup: false });
    });
  });

  describe('edge cases', () => {
    it('should handle very long message content', () => {
      const longContent = 'a'.repeat(10000);
      const message = IncomingMessage.create(
        'msg-1',
        fromPhone,
        toPhone,
        longContent,
        new Date()
      );

      expect(message.content).toBe(longContent);
      expect(message.content.length).toBe(10000);
    });

    it('should handle special characters in content', () => {
      const specialContent = '🎉 Hello! @user #hashtag $100 & more!';
      const message = IncomingMessage.create(
        'msg-1',
        fromPhone,
        toPhone,
        specialContent,
        new Date()
      );

      expect(message.content).toBe(specialContent);
    });

    it('should handle newlines in content', () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      const message = IncomingMessage.create(
        'msg-1',
        fromPhone,
        toPhone,
        multilineContent,
        new Date()
      );

      expect(message.content).toBe(multilineContent);
    });
  });
});
