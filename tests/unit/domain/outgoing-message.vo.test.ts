import { OutgoingMessage } from '../../../src/core/domain/value-objects/outgoing-message.vo';

describe('OutgoingMessage', () => {
  describe('create', () => {
    it('should create a valid OutgoingMessage', () => {
      const message = OutgoingMessage.create('1234567890', 'Hello World');
      expect(message.getTo()).toBe('1234567890');
      expect(message.getContent()).toBe('Hello World');
    });

    it('should create OutgoingMessage with metadata', () => {
      const metadata = { priority: 'high' };
      const message = OutgoingMessage.create('1234567890', 'Hello', metadata);
      expect(message.getMetadata()).toEqual(metadata);
    });

    it('should throw error when recipient is empty', () => {
      expect(() => OutgoingMessage.create('', 'Hello')).toThrow('Recipient (to) cannot be empty');
    });

    it('should throw error when recipient is whitespace only', () => {
      expect(() => OutgoingMessage.create('   ', 'Hello')).toThrow('Recipient (to) cannot be empty');
    });

    it('should throw error when content is empty', () => {
      expect(() => OutgoingMessage.create('1234567890', '')).toThrow('Message content cannot be empty');
    });

    it('should throw error when content is whitespace only', () => {
      expect(() => OutgoingMessage.create('1234567890', '   ')).toThrow('Message content cannot be empty');
    });
  });

  describe('toPlainObject', () => {
    it('should convert to plain object without metadata', () => {
      const message = OutgoingMessage.create('1234567890', 'Hello World');
      const plain = message.toPlainObject();
      expect(plain).toEqual({
        to: '1234567890',
        content: 'Hello World'
      });
    });

    it('should convert to plain object with metadata', () => {
      const metadata = { priority: 'high', retryCount: 3 };
      const message = OutgoingMessage.create('1234567890', 'Hello', metadata);
      const plain = message.toPlainObject();
      expect(plain).toEqual({
        to: '1234567890',
        content: 'Hello',
        metadata
      });
    });
  });
});
