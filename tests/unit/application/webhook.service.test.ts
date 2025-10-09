import { WebhookService } from '../../../src/core/application/webhook.service';
import { CooldownService } from '../../../src/core/application/cooldown.service';
import { Bot } from '../../../src/core/domain/entities/bot.entity';
import { IncomingMessage } from '../../../src/core/domain/dtos/message.dto';
import { BotId } from '../../../src/core/domain/value-objects/bot-id.vo';
import { PhoneNumber } from '../../../src/core/domain/value-objects/phone-number.vo';

// Mock fetch globally
global.fetch = jest.fn();

describe('WebhookService', () => {
  let service: WebhookService;
  let cooldownService: CooldownService;
  let mockBot: Bot;

  beforeEach(() => {
    cooldownService = new CooldownService();
    service = new WebhookService(cooldownService);

    mockBot = {
      id: new BotId('test-bot'),
      name: 'Test Bot',
      phone: new PhoneNumber('+1234567890'),
      settings: {
        simulateTyping: true,
        typingDelay: 1000,
        readReceipts: true,
        ignoreGroups: false,
        ignoredSenders: [],
        adminNumbers: [],
        logLevel: 'info'
      },
      autoResponses: [],
      webhooks: [
        {
          name: 'test-webhook',
          pattern: 'help|support',
          url: 'https://api.example.com/webhook',
          method: 'POST',
          headers: { 'Authorization': 'Bearer token' },
          timeout: 5000,
          retry: 3,
          priority: 1,
          cooldown: 30
        }
      ],
      findMatchingWebhooks: jest.fn()
    } as any;

    jest.clearAllMocks();
  });

  describe('processWebhooks', () => {
    it('should skip messages from bot itself', async () => {
      const message: IncomingMessage = {
        id: 'msg1',
        from: 'sender1',
        to: 'bot',
        content: 'help me',
        timestamp: new Date(),
        metadata: { fromMe: true }
      };

      (mockBot.findMatchingWebhooks as jest.Mock).mockReturnValue([]);

      await service.processWebhooks(mockBot, message);

      expect(mockBot.findMatchingWebhooks).toHaveBeenCalledWith('help me');
    });

    it('should trigger matching webhooks', async () => {
      const message: IncomingMessage = {
        id: 'msg1',
        from: 'sender1',
        to: 'bot',
        content: 'I need help',
        timestamp: new Date(),
        metadata: {}
      };

      (mockBot.findMatchingWebhooks as jest.Mock).mockReturnValue([mockBot.webhooks[0]]);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await service.processWebhooks(mockBot, message);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token'
          }),
          body: expect.any(String)
        })
      );
    });

    it('should handle webhook cooldown', async () => {
      const message: IncomingMessage = {
        id: 'msg1',
        from: 'sender1',
        to: 'bot',
        content: 'help please',
        timestamp: new Date(),
        metadata: {}
      };

      (mockBot.findMatchingWebhooks as jest.Mock).mockReturnValue([mockBot.webhooks[0]]);

      // First call should trigger webhook
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      await service.processWebhooks(mockBot, message);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call should be blocked by cooldown
      await service.processWebhooks(mockBot, message);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should handle multiple matching webhooks', async () => {
      const additionalWebhook = {
        name: 'urgent-webhook',
        pattern: 'urgent|emergency',
        url: 'https://api.example.com/urgent',
        method: 'POST' as const,
        headers: {},
        timeout: 5000,
        retry: 3,
        priority: 1,
        cooldown: 60
      };

      mockBot.webhooks.push(additionalWebhook);

      const message: IncomingMessage = {
        id: 'msg1',
        from: 'sender1',
        to: 'bot',
        content: 'urgent help needed',
        timestamp: new Date(),
        metadata: {}
      };

      (mockBot.findMatchingWebhooks as jest.Mock).mockReturnValue([mockBot.webhooks[0], additionalWebhook]);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await service.processWebhooks(mockBot, message);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle HTTP request failures with retry', async () => {
      const message: IncomingMessage = {
        id: 'msg1',
        from: 'sender1',
        to: 'bot',
        content: 'help',
        timestamp: new Date(),
        metadata: {}
      };

      (mockBot.findMatchingWebhooks as jest.Mock).mockReturnValue([mockBot.webhooks[0]]);

      // Fail twice, succeed on third attempt
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ ok: true });

      await service.processWebhooks(mockBot, message);

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('webhook payload', () => {
    it('should send correct payload structure', async () => {
      const message: IncomingMessage = {
        id: 'msg123',
        from: '521234567890',
        to: 'bot',
        content: 'I need support',
        timestamp: new Date('2025-01-09T01:45:00Z'),
        metadata: { customField: 'value' }
      };

      (mockBot.findMatchingWebhooks as jest.Mock).mockReturnValue([mockBot.webhooks[0]]);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await service.processWebhooks(mockBot, message);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(callArgs[1].body);

      expect(payload).toEqual({
        sender: '521234567890',
        message: 'I need support',
        timestamp: message.timestamp,
        botId: 'test-bot',
        botName: 'Test Bot',
        webhookName: 'test-webhook',
        webhookPattern: 'help|support',
        metadata: { customField: 'value' }
      });
    });
  });
});