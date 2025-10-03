import { WhatsAppSessionManager } from '../../../src/core/infrastructure/whatsapp/whatsapp-session-manager';
import { WhatsAppClient } from '../../../src/core/infrastructure/whatsapp/whatsapp-client';
import { WhatsAppClientState } from '../../../src/core/domain/interfaces/i-whatsapp-client.interface';

// Mock the WhatsAppClient to avoid real WhatsApp connections
jest.mock('../../../src/core/infrastructure/whatsapp/whatsapp-client');

describe('WhatsAppSessionManager', () => {
  let sessionManager: WhatsAppSessionManager;
  const mockBotId1 = 'bot-1';
  const mockBotId2 = 'bot-2';

  beforeEach(() => {
    sessionManager = new WhatsAppSessionManager();
    // Reset the mock for each test
    (WhatsAppClient as jest.MockedClass<typeof WhatsAppClient>).mockClear();
  });

  describe('Client Management', () => {
    it('should create a new WhatsApp client', () => {
      const client = sessionManager.createClient(mockBotId1);

      expect(WhatsAppClient).toHaveBeenCalledWith(mockBotId1);
      expect(client).toBeInstanceOf(WhatsAppClient);
    });

    it('should throw error when creating duplicate client', () => {
      sessionManager.createClient(mockBotId1);
      
      expect(() => {
        sessionManager.createClient(mockBotId1);
      }).toThrow(`WhatsApp client for bot '${mockBotId1}' already exists`);
    });

    it('should get existing client by bot ID', () => {
      const createdClient = sessionManager.createClient(mockBotId1);
      const retrievedClient = sessionManager.getClient(mockBotId1);

      expect(retrievedClient).toBe(createdClient);
    });

    it('should return undefined for non-existent client', () => {
      const client = sessionManager.getClient('non-existent-bot');
      
      expect(client).toBeUndefined();
    });

    it('should check if client exists', () => {
      sessionManager.createClient(mockBotId1);
      
      expect(sessionManager.hasClient(mockBotId1)).toBe(true);
      expect(sessionManager.hasClient('non-existent-bot')).toBe(false);
    });

    it('should get all clients', () => {
      const client1 = sessionManager.createClient(mockBotId1);
      const client2 = sessionManager.createClient(mockBotId2);
      
      const allClients = sessionManager.getAllClients();
      
      expect(allClients.size).toBe(2);
      expect(allClients.get(mockBotId1)).toBe(client1);
      expect(allClients.get(mockBotId2)).toBe(client2);
    });
  });

  describe('Session Management', () => {
    it('should get all sessions', () => {
      const mockClient1 = {
        getSession: jest.fn().mockReturnValue({
          clientId: mockBotId1,
          state: WhatsAppClientState.READY,
          phoneNumber: '+1234567890',
          lastActivity: new Date()
        })
      } as any;

      const mockClient2 = {
        getSession: jest.fn().mockReturnValue({
          clientId: mockBotId2,
          state: WhatsAppClientState.CONNECTING,
          lastActivity: new Date()
        })
      } as any;

      // Mock the WhatsAppClient constructor to return our mock clients
      (WhatsAppClient as jest.MockedClass<typeof WhatsAppClient>)
        .mockImplementationOnce(() => mockClient1)
        .mockImplementationOnce(() => mockClient2);

      sessionManager.createClient(mockBotId1);
      sessionManager.createClient(mockBotId2);

      const sessions = sessionManager.getSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].clientId).toBe(mockBotId1);
      expect(sessions[1].clientId).toBe(mockBotId2);
    });

    it('should get client count', () => {
      expect(sessionManager.getClientCount()).toBe(0);
      
      sessionManager.createClient(mockBotId1);
      expect(sessionManager.getClientCount()).toBe(1);
      
      sessionManager.createClient(mockBotId2);
      expect(sessionManager.getClientCount()).toBe(2);
    });

    it('should get clients by state', () => {
      const mockClient1 = {
        getState: jest.fn().mockReturnValue(WhatsAppClientState.READY)
      } as any;

      const mockClient2 = {
        getState: jest.fn().mockReturnValue(WhatsAppClientState.CONNECTING)
      } as any;

      (WhatsAppClient as jest.MockedClass<typeof WhatsAppClient>)
        .mockImplementationOnce(() => mockClient1)
        .mockImplementationOnce(() => mockClient2);

      sessionManager.createClient(mockBotId1);
      sessionManager.createClient(mockBotId2);

      const readyClients = sessionManager.getClientsByState(WhatsAppClientState.READY);
      const connectingClients = sessionManager.getClientsByState(WhatsAppClientState.CONNECTING);

      expect(readyClients).toHaveLength(1);
      expect(connectingClients).toHaveLength(1);
      expect(readyClients[0]).toBe(mockClient1);
      expect(connectingClients[0]).toBe(mockClient2);
    });
  });

  describe('Client Destruction', () => {
    it('should destroy specific client', async () => {
      const mockDestroy = jest.fn().mockResolvedValue(undefined);
      const mockClient = {
        destroy: mockDestroy
      } as any;

      (WhatsAppClient as jest.MockedClass<typeof WhatsAppClient>).mockImplementation(() => mockClient);

      sessionManager.createClient(mockBotId1);
      expect(sessionManager.hasClient(mockBotId1)).toBe(true);

      await sessionManager.destroyClient(mockBotId1);

      expect(mockDestroy).toHaveBeenCalled();
      expect(sessionManager.hasClient(mockBotId1)).toBe(false);
    });

    it('should not throw when destroying non-existent client', async () => {
      await expect(sessionManager.destroyClient('non-existent-bot')).resolves.not.toThrow();
    });

    it('should destroy all clients', async () => {
      const mockDestroy1 = jest.fn().mockResolvedValue(undefined);
      const mockDestroy2 = jest.fn().mockResolvedValue(undefined);

      const mockClient1 = { destroy: mockDestroy1 } as any;
      const mockClient2 = { destroy: mockDestroy2 } as any;

      (WhatsAppClient as jest.MockedClass<typeof WhatsAppClient>)
        .mockImplementationOnce(() => mockClient1)
        .mockImplementationOnce(() => mockClient2);

      sessionManager.createClient(mockBotId1);
      sessionManager.createClient(mockBotId2);

      await sessionManager.destroyAllClients();

      expect(mockDestroy1).toHaveBeenCalled();
      expect(mockDestroy2).toHaveBeenCalled();
      expect(sessionManager.getClientCount()).toBe(0);
    });
  });

  describe('Client Initialization', () => {
    it('should initialize all clients', async () => {
      const mockInitialize1 = jest.fn().mockResolvedValue(undefined);
      const mockInitialize2 = jest.fn().mockResolvedValue(undefined);

      const mockClient1 = { initialize: mockInitialize1 } as any;
      const mockClient2 = { initialize: mockInitialize2 } as any;

      (WhatsAppClient as jest.MockedClass<typeof WhatsAppClient>)
        .mockImplementationOnce(() => mockClient1)
        .mockImplementationOnce(() => mockClient2);

      sessionManager.createClient(mockBotId1);
      sessionManager.createClient(mockBotId2);

      await sessionManager.initializeAllClients();

      expect(mockInitialize1).toHaveBeenCalled();
      expect(mockInitialize2).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      const mockInitialize1 = jest.fn().mockRejectedValue(new Error('Connection failed'));
      const mockInitialize2 = jest.fn().mockResolvedValue(undefined);

      const mockClient1 = { initialize: mockInitialize1 } as any;
      const mockClient2 = { initialize: mockInitialize2 } as any;

      (WhatsAppClient as jest.MockedClass<typeof WhatsAppClient>)
        .mockImplementationOnce(() => mockClient1)
        .mockImplementationOnce(() => mockClient2);

      sessionManager.createClient(mockBotId1);
      sessionManager.createClient(mockBotId2);

      // Should not throw even if one client fails
      await expect(sessionManager.initializeAllClients()).resolves.not.toThrow();

      expect(mockInitialize1).toHaveBeenCalled();
      expect(mockInitialize2).toHaveBeenCalled();
    });
  });
});