import { Bot } from '../../../src/core/domain/entities/bot.entity';
import { BotId } from '../../../src/core/domain/value-objects/bot-id.vo';
import { PhoneNumber } from '../../../src/core/domain/value-objects/phone-number.vo';
import { BotSettings } from '../../../src/core/domain/value-objects/bot-settings.vo';
import { AutoResponse } from '../../../src/core/domain/value-objects/auto-response.vo';
import { Webhook } from '../../../src/core/domain/value-objects/webhook.vo';
import { ResponsePattern } from '../../../src/core/domain/value-objects/response-pattern.vo';

describe('Bot Entity', () => {
  let botId: BotId;
  let settings: BotSettings;
  let autoResponses: AutoResponse[];
  let webhooks: Webhook[];

  beforeEach(() => {
    botId = new BotId('test-bot');
    settings = BotSettings.createDefault();

    autoResponses = [
      AutoResponse.create({
        pattern: ResponsePattern.create('hello', true),
        response: 'Hi there!',
        priority: 1,
        cooldown: 30
      }),
      AutoResponse.create({
        pattern: ResponsePattern.create('bye', true),
        response: 'Goodbye!',
        priority: 2,
        cooldown: 0
      })
    ];

    webhooks = [
      Webhook.create({
        name: 'greeting-webhook',
        pattern: ResponsePattern.create('hello', true),
        url: 'https://example.com/webhook',
        method: 'POST',
        priority: 1,
        cooldown: 60
      }),
      Webhook.create({
        name: 'farewell-webhook',
        pattern: ResponsePattern.create('bye', true),
        url: 'https://example.com/farewell',
        method: 'POST',
        priority: 2
      })
    ];
  });

  describe('creation', () => {
    it('should create a Bot with all properties', () => {
      const phone = new PhoneNumber('1234567890');
      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        phone,
        autoResponses,
        webhooks
      });

      expect(bot.id).toBe(botId);
      expect(bot.name).toBe('Test Bot');
      expect(bot.phone).toBe(phone);
      expect(bot.settings).toBe(settings);
      expect(bot.autoResponses).toEqual(autoResponses);
      expect(bot.webhooks).toEqual(webhooks);
    });

    it('should create a Bot without phone', () => {
      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        autoResponses,
        webhooks
      });

      expect(bot.phone).toBeUndefined();
    });

    it('should throw error if name is empty', () => {
      expect(() =>
        Bot.create({
          id: botId,
          name: '',
          settings,
          autoResponses,
          webhooks
        })
      ).toThrow('Bot name cannot be empty');
    });

    it('should throw error if name is only whitespace', () => {
      expect(() =>
        Bot.create({
          id: botId,
          name: '   ',
          settings,
          autoResponses,
          webhooks
        })
      ).toThrow('Bot name cannot be empty');
    });
  });

  describe('findMatchingAutoResponse', () => {
    it('should find matching auto-response by pattern', () => {
      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        autoResponses,
        webhooks: []
      });

      const response = bot.findMatchingAutoResponse('hello world');
      expect(response).toBe(autoResponses[0]);
      expect(response?.response).toBe('Hi there!');
    });

    it('should return null if no pattern matches', () => {
      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        autoResponses,
        webhooks: []
      });

      const response = bot.findMatchingAutoResponse('unknown message');
      expect(response).toBeNull();
    });

    it('should prioritize higher priority responses', () => {
      const highPriority = AutoResponse.create({
        pattern: ResponsePattern.create('test', true),
        response: 'High priority',
        priority: 10
      });

      const lowPriority = AutoResponse.create({
        pattern: ResponsePattern.create('test', true),
        response: 'Low priority',
        priority: 1
      });

      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        autoResponses: [lowPriority, highPriority],
        webhooks: []
      });

      const response = bot.findMatchingAutoResponse('test');
      expect(response).toBe(highPriority);
      expect(response?.response).toBe('High priority');
    });

    it('should handle case-insensitive matching', () => {
      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        autoResponses,
        webhooks: []
      });

      const response = bot.findMatchingAutoResponse('HELLO WORLD');
      expect(response).toBe(autoResponses[0]);
    });
  });

  describe('findMatchingWebhook', () => {
    it('should find matching webhook by pattern', () => {
      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks
      });

      const webhook = bot.findMatchingWebhook('hello world');
      expect(webhook).toBe(webhooks[0]);
      expect(webhook?.name).toBe('greeting-webhook');
    });

    it('should return null if no webhook matches', () => {
      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks
      });

      const webhook = bot.findMatchingWebhook('unknown message');
      expect(webhook).toBeNull();
    });

    it('should prioritize higher priority webhooks', () => {
      const highPriority = Webhook.create({
        name: 'high-priority',
        pattern: ResponsePattern.create('test', true),
        url: 'https://example.com/high',
        method: 'POST',
        priority: 10
      });

      const lowPriority = Webhook.create({
        name: 'low-priority',
        pattern: ResponsePattern.create('test', true),
        url: 'https://example.com/low',
        method: 'POST',
        priority: 1
      });

      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks: [lowPriority, highPriority]
      });

      const webhook = bot.findMatchingWebhook('test');
      expect(webhook).toBe(highPriority);
    });
  });

  describe('findMatchingWebhooks', () => {
    it('should find all matching webhooks', () => {
      const webhook1 = Webhook.create({
        name: 'webhook1',
        pattern: ResponsePattern.create('test', true),
        url: 'https://example.com/1',
        method: 'POST',
        priority: 1
      });

      const webhook2 = Webhook.create({
        name: 'webhook2',
        pattern: ResponsePattern.create('test', true),
        url: 'https://example.com/2',
        method: 'POST',
        priority: 2
      });

      const webhook3 = Webhook.create({
        name: 'webhook3',
        pattern: ResponsePattern.create('other', true),
        url: 'https://example.com/3',
        method: 'POST',
        priority: 1
      });

      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks: [webhook1, webhook2, webhook3]
      });

      const matchingWebhooks = bot.findMatchingWebhooks('test');
      expect(matchingWebhooks).toHaveLength(2);
      expect(matchingWebhooks[0]).toBe(webhook2); // Higher priority first
      expect(matchingWebhooks[1]).toBe(webhook1);
    });

    it('should return empty array if no webhooks match', () => {
      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks
      });

      const matchingWebhooks = bot.findMatchingWebhooks('unknown');
      expect(matchingWebhooks).toEqual([]);
    });

    it('should sort webhooks by priority descending', () => {
      const webhook1 = Webhook.create({
        name: 'webhook1',
        pattern: ResponsePattern.create('test', true),
        url: 'https://example.com/1',
        method: 'POST',
        priority: 1
      });

      const webhook2 = Webhook.create({
        name: 'webhook2',
        pattern: ResponsePattern.create('test', true),
        url: 'https://example.com/2',
        method: 'POST',
        priority: 5
      });

      const webhook3 = Webhook.create({
        name: 'webhook3',
        pattern: ResponsePattern.create('test', true),
        url: 'https://example.com/3',
        method: 'POST',
        priority: 3
      });

      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        autoResponses: [],
        webhooks: [webhook1, webhook2, webhook3]
      });

      const matchingWebhooks = bot.findMatchingWebhooks('test');
      expect(matchingWebhooks[0]).toBe(webhook2); // priority 5
      expect(matchingWebhooks[1]).toBe(webhook3); // priority 3
      expect(matchingWebhooks[2]).toBe(webhook1); // priority 1
    });
  });

  describe('getters', () => {
    it('should return all properties via getters', () => {
      const phone = new PhoneNumber('1234567890');
      const bot = Bot.create({
        id: botId,
        name: 'Test Bot',
        settings,
        phone,
        autoResponses,
        webhooks
      });

      expect(bot.id).toBe(botId);
      expect(bot.name).toBe('Test Bot');
      expect(bot.phone).toBe(phone);
      expect(bot.settings).toBe(settings);
      expect(bot.autoResponses).toEqual(autoResponses);
      expect(bot.webhooks).toEqual(webhooks);
    });
  });
});
