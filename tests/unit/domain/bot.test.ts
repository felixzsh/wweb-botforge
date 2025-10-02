import { Bot } from '../../../src/core/domain/entities/bot.entity';
import { BotId } from '../../../src/core/domain/value-objects/bot-id.vo';
import { PhoneNumber } from '../../../src/core/domain/value-objects/phone-number.vo';
import { BotSettings } from '../../../src/core/domain/entities/bot-settings.entity';
import { AutoResponse } from '../../../src/core/domain/entities/auto-response.entity';
import { Webhook } from '../../../src/core/domain/entities/webhook.entity';

describe('Bot', () => {
  let botId: BotId;
  let settings: BotSettings;
  let autoResponses: AutoResponse[];
  let webhooks: Webhook[];

  beforeEach(() => {
    botId = new BotId('test-bot');
    settings = new BotSettings();
    autoResponses = [
      new AutoResponse('hello', 'Hi!', false, 1),
      new AutoResponse('bye', 'Goodbye!', false, 2),
    ];
    webhooks = [
      new Webhook('greeting-webhook', 'hello', 'http://example.com', 'POST', {}, 5000, 3, 1),
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
      const highPriorityResponse = new AutoResponse('test', 'High priority', false, 10);
      const lowPriorityResponse = new AutoResponse('test', 'Low priority', false, 1);
      const bot = new Bot(
        botId,
        'Test Bot',
        settings,
        undefined,
        [lowPriorityResponse, highPriorityResponse],
        []
      );

      const response = bot.findMatchingAutoResponse('test');
      expect(response).toBe(highPriorityResponse);
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
      const highPriorityWebhook = new Webhook('high', 'test', 'http://example.com', 'POST', {}, 5000, 3, 10);
      const lowPriorityWebhook = new Webhook('low', 'test', 'http://example.com', 'POST', {}, 5000, 3, 1);
      const bot = new Bot(
        botId,
        'Test Bot',
        settings,
        undefined,
        [],
        [lowPriorityWebhook, highPriorityWebhook]
      );

      const webhook = bot.findMatchingWebhook('test');
      expect(webhook).toBe(highPriorityWebhook);
    });
  });
});