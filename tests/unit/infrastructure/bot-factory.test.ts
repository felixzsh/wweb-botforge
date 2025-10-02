import { BotFactory } from '../../../src/core/infrastructure/bot-factory';

describe('BotFactory', () => {
  let factory: BotFactory;

  beforeEach(() => {
    factory = new BotFactory();
  });

  describe('createFromConfig', () => {
    it('should create a Bot from minimal config', () => {
      const config = {
        id: 'test-bot',
        name: 'Test Bot',
        settings: {},
        auto_responses: [],
        webhooks: []
      };

      const bot = factory.createFromConfig(config);

      expect(bot.id.value).toBe('test-bot');
      expect(bot.name).toBe('Test Bot');
      expect(bot.phone).toBeUndefined();
      expect(bot.autoResponses).toHaveLength(0);
      expect(bot.webhooks).toHaveLength(0);
    });

    it('should create a Bot with phone number', () => {
      const config = {
        id: 'test-bot',
        name: 'Test Bot',
        phone: '+521234567890',
        settings: {},
        auto_responses: [],
        webhooks: []
      };

      const bot = factory.createFromConfig(config);

      expect(bot.phone?.value).toBe('+521234567890');
    });

    it('should create a Bot with auto responses', () => {
      const config = {
        id: 'test-bot',
        name: 'Test Bot',
        settings: {},
        auto_responses: [
          {
            pattern: 'hello',
            response: 'Hi there!',
            case_insensitive: true,
            priority: 5
          }
        ],
        webhooks: []
      };

      const bot = factory.createFromConfig(config);

      expect(bot.autoResponses).toHaveLength(1);
      expect(bot.autoResponses[0].pattern).toBe('hello');
      expect(bot.autoResponses[0].response).toBe('Hi there!');
      expect(bot.autoResponses[0].caseInsensitive).toBe(true);
      expect(bot.autoResponses[0].priority).toBe(5);
    });

    it('should create a Bot with webhooks', () => {
      const config = {
        id: 'test-bot',
        name: 'Test Bot',
        settings: {},
        auto_responses: [],
        webhooks: [
          {
            name: 'test-webhook',
            pattern: 'order.*',
            url: 'http://example.com/webhook',
            method: 'POST',
            headers: { 'Authorization': 'Bearer token' },
            timeout: 10000,
            retry: 5,
            priority: 10
          }
        ]
      };

      const bot = factory.createFromConfig(config);

      expect(bot.webhooks).toHaveLength(1);
      expect(bot.webhooks[0].name).toBe('test-webhook');
      expect(bot.webhooks[0].pattern).toBe('order.*');
      expect(bot.webhooks[0].url).toBe('http://example.com/webhook');
      expect(bot.webhooks[0].method).toBe('POST');
      expect(bot.webhooks[0].headers).toEqual({ 'Authorization': 'Bearer token' });
      expect(bot.webhooks[0].timeout).toBe(10000);
      expect(bot.webhooks[0].retry).toBe(5);
      expect(bot.webhooks[0].priority).toBe(10);
    });

    it('should create a Bot with custom settings', () => {
      const config = {
        id: 'test-bot',
        name: 'Test Bot',
        settings: {
          simulate_typing: false,
          typing_delay: 2000,
          read_receipts: false,
          ignore_groups: false,
          admin_numbers: ['+521234567891'],
          log_level: 'debug'
        },
        auto_responses: [],
        webhooks: []
      };

      const bot = factory.createFromConfig(config);

      expect(bot.settings.simulateTyping).toBe(false);
      expect(bot.settings.typingDelay).toBe(2000);
      expect(bot.settings.readReceipts).toBe(false);
      expect(bot.settings.ignoreGroups).toBe(false);
      expect(bot.settings.adminNumbers).toHaveLength(1);
      expect(bot.settings.adminNumbers[0].value).toBe('+521234567891');
      expect(bot.settings.logLevel).toBe('debug');
    });
  });

  describe('createBots', () => {
    it('should create multiple bots from raw config', () => {
      const rawConfig = {
        bots: [
          {
            id: 'bot1',
            name: 'Bot 1',
            settings: {},
            auto_responses: [],
            webhooks: []
          },
          {
            id: 'bot2',
            name: 'Bot 2',
            settings: {},
            auto_responses: [],
            webhooks: []
          }
        ]
      };

      const bots = factory.createBots(rawConfig);

      expect(bots).toHaveLength(2);
      expect(bots[0].id.value).toBe('bot1');
      expect(bots[1].id.value).toBe('bot2');
    });
  });
});