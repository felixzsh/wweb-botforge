import { AutoResponseService } from '../../../src/core/application/auto-response.service';
import { MessageQueueService } from '../../../src/core/application/message-queue.service';
import { CooldownService } from '../../../src/core/application/cooldown.service';
import { Bot } from '../../../src/core/domain/entities/bot.entity';
import { IncomingMessage } from '../../../src/core/domain/dtos/message.dto';
import { BotId } from '../../../src/core/domain/value-objects/bot-id.vo';
import { PhoneNumber } from '../../../src/core/domain/value-objects/phone-number.vo';

// Mock services
jest.mock('../../../src/core/application/message-queue.service');
jest.mock('../../../src/core/application/cooldown.service');

describe('AutoResponseService', () => {
  let service: AutoResponseService;
  let mockMessageQueue: jest.Mocked<MessageQueueService>;
  let mockCooldownService: jest.Mocked<CooldownService>;
  let mockBot: Bot;

  beforeEach(() => {
    mockMessageQueue = new MessageQueueService() as jest.Mocked<MessageQueueService>;
    mockCooldownService = new CooldownService() as jest.Mocked<CooldownService>;
    service = new AutoResponseService(mockMessageQueue, mockCooldownService);

    // Create mock bot
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
      autoResponses: [
        {
          pattern: 'hello',
          response: 'Hi there!',
          caseInsensitive: true,
          priority: 1,
          cooldown: 30
        },
        {
          pattern: 'bye',
          response: 'Goodbye!',
          caseInsensitive: true,
          priority: 1,
          cooldown: 0 // No cooldown
        }
      ],
      webhooks: [],
      findMatchingAutoResponse: jest.fn()
    } as any;
  });

  describe('processMessage', () => {
    it('should return matching response when not on cooldown', () => {
      const message: IncomingMessage = {
        id: 'msg1',
        from: 'sender1',
        to: 'bot',
        content: 'hello world',
        timestamp: new Date(),
        metadata: {}
      };

      (mockBot.findMatchingAutoResponse as jest.Mock).mockReturnValue(mockBot.autoResponses[0]);

      const result = service.processMessage(mockBot, message);

      expect(result).toEqual(mockBot.autoResponses[0]);
    });

    it('should return null when on cooldown', () => {
      const message: IncomingMessage = {
        id: 'msg1',
        from: 'sender1',
        to: 'bot',
        content: 'hello world',
        timestamp: new Date(),
        metadata: {}
      };

      (mockBot.findMatchingAutoResponse as jest.Mock).mockReturnValue(mockBot.autoResponses[0]);

      // First call - should work
      const result1 = service.processMessage(mockBot, message);
      expect(result1).toEqual(mockBot.autoResponses[0]);

      // Second call immediately - should be on cooldown
      const result2 = service.processMessage(mockBot, message);
      expect(result2).toBeNull();
    });

    it('should allow different senders to trigger same pattern', () => {
      const message1: IncomingMessage = {
        id: 'msg1',
        from: 'sender1',
        to: 'bot',
        content: 'hello world',
        timestamp: new Date(),
        metadata: {}
      };

      const message2: IncomingMessage = {
        id: 'msg2',
        from: 'sender2',
        to: 'bot',
        content: 'hello world',
        timestamp: new Date(),
        metadata: {}
      };

      (mockBot.findMatchingAutoResponse as jest.Mock).mockReturnValue(mockBot.autoResponses[0]);

      // Both should work since different senders
      const result1 = service.processMessage(mockBot, message1);
      const result2 = service.processMessage(mockBot, message2);

      expect(result1).toEqual(mockBot.autoResponses[0]);
      expect(result2).toEqual(mockBot.autoResponses[0]);
    });

    it('should allow same sender different patterns independently', () => {
      const message1: IncomingMessage = {
        id: 'msg1',
        from: 'sender1',
        to: 'bot',
        content: 'hello',
        timestamp: new Date(),
        metadata: {}
      };

      const message2: IncomingMessage = {
        id: 'msg2',
        from: 'sender1',
        to: 'bot',
        content: 'bye',
        timestamp: new Date(),
        metadata: {}
      };

      (mockBot.findMatchingAutoResponse as jest.Mock)
        .mockReturnValueOnce(mockBot.autoResponses[0]) // hello
        .mockReturnValueOnce(mockBot.autoResponses[1]); // bye

      // Both should work since different patterns
      const result1 = service.processMessage(mockBot, message1);
      const result2 = service.processMessage(mockBot, message2);

      expect(result1).toEqual(mockBot.autoResponses[0]);
      expect(result2).toEqual(mockBot.autoResponses[1]);
    });

    it('should not apply cooldown when cooldown is 0', () => {
      const message: IncomingMessage = {
        id: 'msg1',
        from: 'sender1',
        to: 'bot',
        content: 'bye world',
        timestamp: new Date(),
        metadata: {}
      };

      (mockBot.findMatchingAutoResponse as jest.Mock).mockReturnValue(mockBot.autoResponses[1]);

      // Multiple calls should work since no cooldown
      const result1 = service.processMessage(mockBot, message);
      const result2 = service.processMessage(mockBot, message);

      expect(result1).toEqual(mockBot.autoResponses[1]);
      expect(result2).toEqual(mockBot.autoResponses[1]);
    });

    it('should skip messages from bot itself', () => {
      const message: IncomingMessage = {
        id: 'msg1',
        from: 'sender1',
        to: 'bot',
        content: 'hello',
        timestamp: new Date(),
        metadata: { fromMe: true }
      };

      const result = service.processMessage(mockBot, message);

      expect(result).toBeNull();
      expect(mockBot.findMatchingAutoResponse).not.toHaveBeenCalled();
    });

    it('should skip group messages when configured', () => {
      mockBot.settings.ignoreGroups = true;

      const message: IncomingMessage = {
        id: 'msg1',
        from: 'group@g.us',
        to: 'bot',
        content: 'hello',
        timestamp: new Date(),
        metadata: {}
      };

      const result = service.processMessage(mockBot, message);

      expect(result).toBeNull();
      expect(mockBot.findMatchingAutoResponse).not.toHaveBeenCalled();
    });
  });
});

