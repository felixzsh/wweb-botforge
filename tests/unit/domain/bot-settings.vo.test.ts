import { BotSettings } from '../../../src/core/domain/value-objects/bot-settings.vo';

describe('BotSettings Value Object', () => {
  describe('create', () => {
    it('should create BotSettings with valid props', () => {
      const settings = BotSettings.create({
        simulateTyping: true,
        typingDelay: 1000,
        queueDelay: 1500,
        readReceipts: true,
        ignoreGroups: false,
        ignoredSenders: ['1234567890'],
        adminNumbers: ['9876543210']
      });

      expect(settings.simulateTyping).toBe(true);
      expect(settings.typingDelay).toBe(1000);
      expect(settings.queueDelay).toBe(1500);
      expect(settings.readReceipts).toBe(true);
      expect(settings.ignoreGroups).toBe(false);
      expect(settings.ignoredSenders).toEqual(['1234567890']);
      expect(settings.adminNumbers).toEqual(['9876543210']);
    });

    it('should throw error when typingDelay is negative', () => {
      expect(() =>
        BotSettings.create({
          simulateTyping: true,
          typingDelay: -100,
          queueDelay: 1000,
          readReceipts: true,
          ignoreGroups: false,
          ignoredSenders: [],
          adminNumbers: []
        })
      ).toThrow('Typing delay must be non-negative');
    });

    it('should throw error when queueDelay is negative', () => {
      expect(() =>
        BotSettings.create({
          simulateTyping: true,
          typingDelay: 1000,
          queueDelay: -500,
          readReceipts: true,
          ignoreGroups: false,
          ignoredSenders: [],
          adminNumbers: []
        })
      ).toThrow('Queue delay must be non-negative');
    });

    it('should allow zero delays', () => {
      const settings = BotSettings.create({
        simulateTyping: false,
        typingDelay: 0,
        queueDelay: 0,
        readReceipts: false,
        ignoreGroups: true,
        ignoredSenders: [],
        adminNumbers: []
      });

      expect(settings.typingDelay).toBe(0);
      expect(settings.queueDelay).toBe(0);
    });
  });

  describe('createDefault', () => {
    it('should create default BotSettings', () => {
      const settings = BotSettings.createDefault();

      expect(settings.simulateTyping).toBe(true);
      expect(settings.typingDelay).toBe(1000);
      expect(settings.queueDelay).toBe(1000);
      expect(settings.readReceipts).toBe(true);
      expect(settings.ignoreGroups).toBe(true);
      expect(settings.ignoredSenders).toEqual([]);
      expect(settings.adminNumbers).toEqual([]);
    });
  });

  describe('isAdminNumber', () => {
    it('should return true for admin numbers', () => {
      const settings = BotSettings.create({
        simulateTyping: true,
        typingDelay: 1000,
        queueDelay: 1000,
        readReceipts: true,
        ignoreGroups: false,
        ignoredSenders: [],
        adminNumbers: ['1234567890', '9876543210']
      });

      expect(settings.isAdminNumber('1234567890')).toBe(true);
      expect(settings.isAdminNumber('9876543210')).toBe(true);
    });

    it('should return false for non-admin numbers', () => {
      const settings = BotSettings.create({
        simulateTyping: true,
        typingDelay: 1000,
        queueDelay: 1000,
        readReceipts: true,
        ignoreGroups: false,
        ignoredSenders: [],
        adminNumbers: ['1234567890']
      });

      expect(settings.isAdminNumber('5555555555')).toBe(false);
    });

    it('should return false when no admin numbers are configured', () => {
      const settings = BotSettings.createDefault();

      expect(settings.isAdminNumber('1234567890')).toBe(false);
    });
  });

  describe('isIgnoredSender', () => {
    it('should return true for ignored senders', () => {
      const settings = BotSettings.create({
        simulateTyping: true,
        typingDelay: 1000,
        queueDelay: 1000,
        readReceipts: true,
        ignoreGroups: false,
        ignoredSenders: ['1234567890', 'status@broadcast'],
        adminNumbers: []
      });

      expect(settings.isIgnoredSender('1234567890')).toBe(true);
      expect(settings.isIgnoredSender('status@broadcast')).toBe(true);
    });

    it('should return false for non-ignored senders', () => {
      const settings = BotSettings.create({
        simulateTyping: true,
        typingDelay: 1000,
        queueDelay: 1000,
        readReceipts: true,
        ignoreGroups: false,
        ignoredSenders: ['1234567890'],
        adminNumbers: []
      });

      expect(settings.isIgnoredSender('5555555555')).toBe(false);
    });

    it('should return false when no ignored senders are configured', () => {
      const settings = BotSettings.createDefault();

      expect(settings.isIgnoredSender('1234567890')).toBe(false);
    });
  });

  describe('getters', () => {
    it('should provide access to all properties via getters', () => {
      const props = {
        simulateTyping: false,
        typingDelay: 2000,
        queueDelay: 3000,
        readReceipts: false,
        ignoreGroups: true,
        ignoredSenders: ['sender1', 'sender2'],
        adminNumbers: ['admin1']
      };

      const settings = BotSettings.create(props);

      expect(settings.simulateTyping).toBe(props.simulateTyping);
      expect(settings.typingDelay).toBe(props.typingDelay);
      expect(settings.queueDelay).toBe(props.queueDelay);
      expect(settings.readReceipts).toBe(props.readReceipts);
      expect(settings.ignoreGroups).toBe(props.ignoreGroups);
      expect(settings.ignoredSenders).toEqual(props.ignoredSenders);
      expect(settings.adminNumbers).toEqual(props.adminNumbers);
    });
  });
});
