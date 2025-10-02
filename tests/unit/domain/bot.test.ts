import { Bot, BotSettingsData, AutoResponseData, WebhookData } from '../../../src/core/domain/entities/bot.entity';
import { BotId } from '../../../src/core/domain/value-objects/bot-id.vo';
import { PhoneNumber } from '../../../src/core/domain/value-objects/phone-number.vo';

describe('Bot', () => {
  let botId: BotId;
  let settings: BotSettingsData;
  let autoResponses: AutoResponseData[];
  let webhooks: WebhookData[];

  beforeEach(() => {
    botId = new BotId('test-bot');
    settings = {
      simulateTyping: true,
      typingDelay: 1000,
      readReceipts: true,
      ignoreGroups: true,
      adminNumbers: [],
      logLevel: 'info'
    };
    autoResponses = [
      { pattern: 'hello', response: 'Hi!', caseInsensitive: false, priority: 1 },
      { pattern: 'bye', response: 'Goodbye!', caseInsensitive: false, priority: 2 },
    ];
    webhooks = [
      { name: 'greeting-webhook', pattern: 'hello', url: 'http://example.com', method: 'POST', headers: {}, timeout: 5000, retry: 3, priority: 1 },
    ];
  });

  describe('constructor', () => {
    it('should create a Bot without phone', () => {
      const bot = new Bot(botId, 'Test Bot', settings, undefined, autoResponses, webhooks);
      expect(bot.id).toBe(botId);
      expect(bot.name).toBe('Test Bot');
      expect(bot.phone).toBeUndefined();
      expect(bot.settings).toBe(settings);
      expect(bot.autoResponses).toEqual(autoResponses);
      expect(bot.webhooks).toEqual(webhooks);
    });

    it('should create a Bot with phone', () => {
      const phone = new PhoneNumber('+521234567890');
      const bot = new Bot(botId, 'Test Bot', settings, phone, autoResponses, webhooks);
      expect(bot.phone).toBe(phone);
    });
  });

  describe('findMatchingAutoResponse', () => {
    it('should return the highest priority matching response', () => {
      const bot = new Bot(botId, 'Test Bot', settings, undefined, autoResponses, []);

      const response = bot.findMatchingAutoResponse('hello');
      expect(response).toBe(autoResponses[0]); // 'hello' matches first response with priority 1
    });

    it('should return null if no match', () => {
      const bot = new Bot(botId, 'Test Bot', settings, undefined, autoResponses, []);

      const response = bot.findMatchingAutoResponse('unknown');
      expect(response).toBeNull();
    });

    it('should prioritize higher priority responses', () => {
      const highPriorityResponse: AutoResponseData = { pattern: 'test', response: 'High priority', caseInsensitive: false, priority: 10 };
      const lowPriorityResponse: AutoResponseData = { pattern: 'test', response: 'Low priority', caseInsensitive: false, priority: 1 };
      const bot = new Bot(
        botId,
        'Test Bot',
        settings,
        undefined,
        [lowPriorityResponse, highPriorityResponse],
        []
      );

      const response = bot.findMatchingAutoResponse('test');
      expect(response).toEqual(highPriorityResponse);
    });
  });

  describe('findMatchingWebhook', () => {
    it('should return the highest priority matching webhook', () => {
      const bot = new Bot(botId, 'Test Bot', settings, undefined, [], webhooks);

      const webhook = bot.findMatchingWebhook('hello');
      expect(webhook).toBe(webhooks[0]);
    });

    it('should return null if no match', () => {
      const bot = new Bot(botId, 'Test Bot', settings, undefined, [], webhooks);

      const webhook = bot.findMatchingWebhook('unknown');
      expect(webhook).toBeNull();
    });

    it('should prioritize higher priority webhooks', () => {
      const highPriorityWebhook: WebhookData = { name: 'high', pattern: 'test', url: 'http://example.com', method: 'POST', headers: {}, timeout: 5000, retry: 3, priority: 10 };
      const lowPriorityWebhook: WebhookData = { name: 'low', pattern: 'test', url: 'http://example.com', method: 'POST', headers: {}, timeout: 5000, retry: 3, priority: 1 };
      const bot = new Bot(
        botId,
        'Test Bot',
        settings,
        undefined,
        [],
        [lowPriorityWebhook, highPriorityWebhook]
      );

      const webhook = bot.findMatchingWebhook('test');
      expect(webhook).toEqual(highPriorityWebhook);
    });
  });
});