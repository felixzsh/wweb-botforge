import { WhatsAppClient } from '../../../src/core/infrastructure/whatsapp/whatsapp-client';
import { WhatsAppClientState } from '../../../src/core/domain/interfaces/i-whatsapp-client.interface';

// Mock whatsapp-web.js
jest.mock('whatsapp-web.js', () => {
  const mockClient = {
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue({ id: { _serialized: 'message-123' } }),
    on: jest.fn(),
    info: {
      wid: {
        user: '+1234567890'
      }
    }
  };

  return {
    Client: jest.fn().mockImplementation(() => mockClient),
    LocalAuth: jest.fn().mockImplementation(() => ({})),
    Message: {
      prototype: {}
    }
  };
});

describe('WhatsAppClient', () => {
  let whatsappClient: WhatsAppClient;
  const mockBotId = 'test-bot-123';

  beforeEach(() => {
    whatsappClient = new WhatsAppClient(mockBotId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create client with correct configuration', () => {
      const { Client, LocalAuth } = require('whatsapp-web.js');
      
      expect(Client).toHaveBeenCalledWith({
        authStrategy: expect.any(Object),
        puppeteer: {
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
      });
      
      expect(LocalAuth).toHaveBeenCalledWith({
        clientId: mockBotId,
        dataPath: './sessions'
      });
    });

    it('should have initial state as DISCONNECTED', () => {
      expect(whatsappClient.getState()).toBe(WhatsAppClientState.DISCONNECTED);
    });

    it('should return session information', () => {
      const session = whatsappClient.getSession();
      
      expect(session).toEqual({
        clientId: mockBotId,
        state: WhatsAppClientState.DISCONNECTED,
        lastActivity: expect.any(Date)
      });
    });
  });

  describe('Event Handling', () => {
    it('should register QR code listener', () => {
      const callback = jest.fn();
      whatsappClient.onQRCode(callback);
      
      // Simulate QR code event
      const mockClient = require('whatsapp-web.js').Client.mock.results[0].value;
      const qrHandler = mockClient.on.mock.calls.find(call => call[0] === 'qr')[1];
      qrHandler('test-qr-code');
      
      expect(callback).toHaveBeenCalledWith('test-qr-code');
    });

    it('should register ready listener', () => {
      const callback = jest.fn();
      whatsappClient.onReady(callback);
      
      // Simulate ready event
      const mockClient = require('whatsapp-web.js').Client.mock.results[0].value;
      const readyHandler = mockClient.on.mock.calls.find(call => call[0] === 'ready')[1];
      readyHandler();
      
      expect(callback).toHaveBeenCalled();
    });

    it('should remove event listeners', () => {
      const callback = jest.fn();
      
      whatsappClient.onQRCode(callback);
      whatsappClient.removeQRCodeListener(callback);
      
      // Simulate QR code event
      const mockClient = require('whatsapp-web.js').Client.mock.results[0].value;
      const qrHandler = mockClient.on.mock.calls.find(call => call[0] === 'qr')[1];
      qrHandler('test-qr-code');
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Message Sending', () => {
    it('should throw error when client is not ready', async () => {
      await expect(
        whatsappClient.sendMessage('+1234567890', 'Hello')
      ).rejects.toThrow('WhatsApp client is not ready');
    });

    it('should send message when client is ready', async () => {
      // Set client to ready state
      const mockClient = require('whatsapp-web.js').Client.mock.results[0].value;
      const readyHandler = mockClient.on.mock.calls.find(call => call[0] === 'ready')[1];
      readyHandler();
      
      const messageId = await whatsappClient.sendMessage('+1234567890', 'Hello');
      
      expect(messageId).toBe('message-123');
      expect(mockClient.sendMessage).toHaveBeenCalledWith('+1234567890', 'Hello', undefined);
    });
  });

  describe('State Management', () => {
    it('should update state on QR code event', () => {
      const mockClient = require('whatsapp-web.js').Client.mock.results[0].value;
      const qrHandler = mockClient.on.mock.calls.find(call => call[0] === 'qr')[1];
      
      qrHandler('test-qr');
      
      expect(whatsappClient.getState()).toBe(WhatsAppClientState.AUTHENTICATING);
      expect(whatsappClient.getSession().qrCode).toBe('test-qr');
    });

    it('should update state on ready event', () => {
      const mockClient = require('whatsapp-web.js').Client.mock.results[0].value;
      const readyHandler = mockClient.on.mock.calls.find(call => call[0] === 'ready')[1];
      
      readyHandler();
      
      expect(whatsappClient.getState()).toBe(WhatsAppClientState.READY);
      expect(whatsappClient.getSession().phoneNumber).toBe('+1234567890');
    });

    it('should update state on auth failure', () => {
      const mockClient = require('whatsapp-web.js').Client.mock.results[0].value;
      const authFailureHandler = mockClient.on.mock.calls.find(call => call[0] === 'auth_failure')[1];
      
      authFailureHandler(new Error('Auth failed'));
      
      expect(whatsappClient.getState()).toBe(WhatsAppClientState.FAILED);
    });

    it('should update state on disconnected', () => {
      const mockClient = require('whatsapp-web.js').Client.mock.results[0].value;
      const disconnectedHandler = mockClient.on.mock.calls.find(call => call[0] === 'disconnected')[1];
      
      disconnectedHandler('logout');
      
      expect(whatsappClient.getState()).toBe(WhatsAppClientState.DISCONNECTED);
    });
  });

  describe('Cleanup', () => {
    it('should destroy client and clear listeners', async () => {
      const callback = jest.fn();
      whatsappClient.onQRCode(callback);
      
      await whatsappClient.destroy();
      
      const mockClient = require('whatsapp-web.js').Client.mock.results[0].value;
      expect(mockClient.destroy).toHaveBeenCalled();
      expect(whatsappClient.getState()).toBe(WhatsAppClientState.DISCONNECTED);
      
      // Verify listeners are cleared
      const qrHandler = mockClient.on.mock.calls.find(call => call[0] === 'qr')[1];
      qrHandler('test-qr');
      expect(callback).not.toHaveBeenCalled();
    });
  });
});