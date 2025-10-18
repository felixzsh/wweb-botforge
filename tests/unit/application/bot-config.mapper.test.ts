import { BotConfigMapper } from '../../../src/core/application/mappers/bot-config.mapper';
import { BotConfigDTO } from '../../../src/core/application/dtos/config-file.dto';
import { Bot } from '../../../src/core/domain/entities/bot.entity';
import { BotId } from '../../../src/core/domain/value-objects/bot-id.vo';
import { PhoneNumber } from '../../../src/core/domain/value-objects/phone-number.vo';
import { BotSettings } from '../../../src/core/domain/value-objects/bot-settings.vo';

describe('BotConfigMapper', () => {
  describe('toDomain', () => {
    it('should map minimal bot configuration to domain entity', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot'
      };

      const bot = BotConfigMapper.toDomain(dto);

      expect(bot).toBeInstanceOf(Bot);
      expect(bot.id.value).toBe('test-bot');
      expect(bot.name).toBe('Test Bot');
      expect(bot.phone).toBeUndefined();
      expect(bot.autoResponses).toHaveLength(0);
      expect(bot.webhooks).toHaveLength(0);
    });

    it('should map bot with phone number', () => {
      const dto: BotConfigDTO = {
        id: 'support-bot',
        name: 'Support Bot',
        phone: '1234567890'
      };

      const bot = BotConfigMapper.toDomain(dto);

      expect(bot.phone).toBeDefined();
      expect(bot.phone?.value).toBe('1234567890');
    });

    it('should map bot with default settings when settings not provided', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot'
      };

      const bot = BotConfigMapper.toDomain(dto);

      expect(bot.settings.simulateTyping).toBe(true);
      expect(bot.settings.typingDelay).toBe(1000);
      expect(bot.settings.queueDelay).toBe(1000);
      expect(bot.settings.readReceipts).toBe(true);
      expect(bot.settings.ignoreGroups).toBe(true);
      expect(bot.settings.ignoredSenders).toEqual([]);
      expect(bot.settings.adminNumbers).toEqual([]);
    });

    it('should map bot with custom settings', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        settings: {
          simulate_typing: false,
          typing_delay: 500,
          queue_delay: 2000,
          read_receipts: false,
          ignore_groups: false,
          ignored_senders: ['1111111111', '2222222222'],
          admin_numbers: ['9999999999']
        }
      };

      const bot = BotConfigMapper.toDomain(dto);

      expect(bot.settings.simulateTyping).toBe(false);
      expect(bot.settings.typingDelay).toBe(500);
      expect(bot.settings.queueDelay).toBe(2000);
      expect(bot.settings.readReceipts).toBe(false);
      expect(bot.settings.ignoreGroups).toBe(false);
      expect(bot.settings.ignoredSenders).toEqual(['1111111111', '2222222222']);
      expect(bot.settings.adminNumbers).toEqual(['9999999999']);
    });

    it('should map auto-responses with default priority', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        auto_responses: [
          {
            pattern: 'hello',
            response: 'Hi there!'
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(dto);

      expect(bot.autoResponses).toHaveLength(1);
      expect(bot.autoResponses[0].response).toBe('Hi there!');
      expect(bot.autoResponses[0].priority).toBe(1);
    });

    it('should map auto-responses with custom priority and cooldown', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        auto_responses: [
          {
            pattern: 'help',
            response: 'How can I help?',
            priority: 5,
            cooldown: 60,
            case_insensitive: true
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(dto);

      expect(bot.autoResponses).toHaveLength(1);
      expect(bot.autoResponses[0].priority).toBe(5);
      expect(bot.autoResponses[0].cooldown).toBe(60);
    });

    it('should map multiple auto-responses', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        auto_responses: [
          {
            pattern: 'hello',
            response: 'Hi!',
            priority: 1
          },
          {
            pattern: 'bye',
            response: 'Goodbye!',
            priority: 2
          },
          {
            pattern: 'help',
            response: 'How can I help?',
            priority: 3
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(dto);

      expect(bot.autoResponses).toHaveLength(3);
      expect(bot.autoResponses[0].response).toBe('Hi!');
      expect(bot.autoResponses[1].response).toBe('Goodbye!');
      expect(bot.autoResponses[2].response).toBe('How can I help?');
    });

    it('should map webhooks with default values', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        webhooks: [
          {
            name: 'order-webhook',
            pattern: 'order',
            url: 'https://api.example.com/orders'
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(dto);

      expect(bot.webhooks).toHaveLength(1);
      expect(bot.webhooks[0].name).toBe('order-webhook');
      expect(bot.webhooks[0].url).toBe('https://api.example.com/orders');
      expect(bot.webhooks[0].method).toBe('POST');
      expect(bot.webhooks[0].timeout).toBe(5000);
      expect(bot.webhooks[0].retries).toBe(3);
      expect(bot.webhooks[0].priority).toBe(1);
    });

    it('should map webhooks with custom values', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        webhooks: [
          {
            name: 'custom-webhook',
            pattern: 'custom',
            url: 'https://api.example.com/custom',
            method: 'PUT',
            timeout: 10000,
            retry: 5,
            priority: 2,
            cooldown: 120,
            headers: {
              'Authorization': 'Bearer token123',
              'X-Custom-Header': 'value'
            }
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(dto);

      expect(bot.webhooks).toHaveLength(1);
      expect(bot.webhooks[0].method).toBe('PUT');
      expect(bot.webhooks[0].timeout).toBe(10000);
      expect(bot.webhooks[0].retries).toBe(5);
      expect(bot.webhooks[0].priority).toBe(2);
      expect(bot.webhooks[0].cooldown).toBe(120);
      expect(bot.webhooks[0].headers['Authorization']).toBe('Bearer token123');
    });

    it('should map multiple webhooks', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        webhooks: [
          {
            name: 'webhook1',
            pattern: 'pattern1',
            url: 'https://api.example.com/1'
          },
          {
            name: 'webhook2',
            pattern: 'pattern2',
            url: 'https://api.example.com/2'
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(dto);

      expect(bot.webhooks).toHaveLength(2);
      expect(bot.webhooks[0].name).toBe('webhook1');
      expect(bot.webhooks[1].name).toBe('webhook2');
    });

    it('should map complete bot configuration', () => {
      const dto: BotConfigDTO = {
        id: 'complete-bot',
        name: 'Complete Bot',
        phone: '1234567890',
        settings: {
          simulate_typing: true,
          typing_delay: 1500,
          queue_delay: 1000,
          read_receipts: true,
          ignore_groups: false,
          ignored_senders: ['spam@broadcast'],
          admin_numbers: ['9999999999']
        },
        auto_responses: [
          {
            pattern: 'hello',
            response: 'Hello!',
            priority: 1,
            cooldown: 30
          }
        ],
        webhooks: [
          {
            name: 'order-webhook',
            pattern: 'order',
            url: 'https://api.example.com/orders',
            method: 'POST',
            priority: 1
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(dto);

      expect(bot.id.value).toBe('complete-bot');
      expect(bot.name).toBe('Complete Bot');
      expect(bot.phone?.value).toBe('1234567890');
      expect(bot.autoResponses).toHaveLength(1);
      expect(bot.webhooks).toHaveLength(1);
      expect(bot.settings.ignoreGroups).toBe(false);
    });

    it('should throw error for invalid bot ID', () => {
      const dto: BotConfigDTO = {
        id: 'ab', // Too short
        name: 'Test Bot'
      };

      expect(() => BotConfigMapper.toDomain(dto)).toThrow('Bot ID must be at least 3 characters long');
    });

    it('should throw error for empty bot name', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: '' // Empty name
      };

      expect(() => BotConfigMapper.toDomain(dto)).toThrow('Bot name cannot be empty');
    });

    it('should throw error for invalid phone number', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        phone: 'invalid' // Invalid phone
      };

      expect(() => BotConfigMapper.toDomain(dto)).toThrow('Invalid phone number format');
    });

    it('should throw error for invalid regex pattern in auto-response', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        auto_responses: [
          {
            pattern: '[invalid(regex', // Invalid regex
            response: 'Response'
          }
        ]
      };

      expect(() => BotConfigMapper.toDomain(dto)).toThrow('Invalid regex pattern');
    });

    it('should throw error for empty auto-response text', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        auto_responses: [
          {
            pattern: 'hello',
            response: '' // Empty response
          }
        ]
      };

      expect(() => BotConfigMapper.toDomain(dto)).toThrow('Response cannot be empty');
    });

    it('should throw error for negative priority in auto-response', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        auto_responses: [
          {
            pattern: 'hello',
            response: 'Hi',
            priority: -1 // Negative priority
          }
        ]
      };

      expect(() => BotConfigMapper.toDomain(dto)).toThrow('Priority must be non-negative');
    });

    it('should throw error for empty webhook name', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        webhooks: [
          {
            name: '', // Empty name
            pattern: 'pattern',
            url: 'https://api.example.com'
          }
        ]
      };

      expect(() => BotConfigMapper.toDomain(dto)).toThrow('Webhook name cannot be empty');
    });

    it('should throw error for empty webhook URL', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        webhooks: [
          {
            name: 'webhook',
            pattern: 'pattern',
            url: '' // Empty URL
          }
        ]
      };

      expect(() => BotConfigMapper.toDomain(dto)).toThrow('Webhook URL cannot be empty');
    });

    it('should throw error for negative webhook priority', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        webhooks: [
          {
            name: 'webhook',
            pattern: 'pattern',
            url: 'https://api.example.com',
            priority: -1 // Negative priority
          }
        ]
      };

      expect(() => BotConfigMapper.toDomain(dto)).toThrow('Priority must be non-negative');
    });

    it('should throw error for negative typing delay', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        settings: {
          typing_delay: -100 // Negative delay
        }
      };

      expect(() => BotConfigMapper.toDomain(dto)).toThrow('Typing delay must be non-negative');
    });

    it('should throw error for negative queue delay', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        settings: {
          queue_delay: -100 // Negative delay
        }
      };

      expect(() => BotConfigMapper.toDomain(dto)).toThrow('Queue delay must be non-negative');
    });
  });

  describe('toDTO', () => {
    it('should convert bot entity back to DTO', () => {
      const dto: BotConfigDTO = {
        id: 'test-bot',
        name: 'Test Bot',
        phone: '1234567890',
        auto_responses: [
          {
            pattern: 'hello',
            response: 'Hi!',
            priority: 1
          }
        ],
        webhooks: [
          {
            name: 'webhook',
            pattern: 'pattern',
            url: 'https://api.example.com',
            method: 'POST',
            priority: 1
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(dto);
      const convertedDto = BotConfigMapper.toDTO(bot);

      expect(convertedDto.id).toBe('test-bot');
      expect(convertedDto.name).toBe('Test Bot');
      expect(convertedDto.phone).toBe('1234567890');
      expect(convertedDto.auto_responses).toHaveLength(1);
      expect(convertedDto.webhooks).toHaveLength(1);
    });
  });
});
