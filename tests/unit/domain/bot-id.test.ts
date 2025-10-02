import { BotId } from '../../../src/core/domain/value-objects/bot-id.vo';

describe('BotId', () => {
  describe('constructor', () => {
    it('should create a valid BotId', () => {
      const botId = new BotId('test-bot');
      expect(botId.value).toBe('test-bot');
    });

    it('should throw error for id too short', () => {
      expect(() => new BotId('ab')).toThrow('Bot ID must be at least 3 characters long');
    });

    it('should throw error for invalid characters', () => {
      expect(() => new BotId('test_bot')).toThrow('Bot ID can only contain lowercase letters, numbers and hyphens');
      expect(() => new BotId('Test-Bot')).toThrow('Bot ID can only contain lowercase letters, numbers and hyphens');
    });
  });

  describe('equals', () => {
    it('should return true for equal BotIds', () => {
      const botId1 = new BotId('test-bot');
      const botId2 = new BotId('test-bot');
      expect(botId1.equals(botId2)).toBe(true);
    });

    it('should return false for different BotIds', () => {
      const botId1 = new BotId('test-bot');
      const botId2 = new BotId('other-bot');
      expect(botId1.equals(botId2)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should return the value', () => {
      const botId = new BotId('test-bot');
      expect(botId.toString()).toBe('test-bot');
    });
  });
});