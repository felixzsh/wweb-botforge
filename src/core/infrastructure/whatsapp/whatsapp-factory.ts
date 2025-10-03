import { IWhatsAppClient, IWhatsAppSessionManager } from '../../domain/interfaces/i-whatsapp-client.interface';
import { WhatsAppClient } from './whatsapp-client';
import { WhatsAppSessionManager } from './whatsapp-session-manager';
import { WhatsAppMessageHandler } from './whatsapp-message-handler';

/**
 * Factory class for creating and managing WhatsApp infrastructure components
 * This provides a centralized way to create and coordinate all WhatsApp-related services
 */
export class WhatsAppFactory {
  private static sessionManager: IWhatsAppSessionManager;
  private static messageHandler: WhatsAppMessageHandler;

  /**
   * Get or create the session manager singleton
   */
  static getSessionManager(): IWhatsAppSessionManager {
    if (!this.sessionManager) {
      this.sessionManager = new WhatsAppSessionManager();
    }
    return this.sessionManager;
  }

  /**
   * Get or create the message handler singleton
   */
  static getMessageHandler(): WhatsAppMessageHandler {
    if (!this.messageHandler) {
      this.messageHandler = new WhatsAppMessageHandler();
    }
    return this.messageHandler;
  }

  /**
   * Create a new WhatsApp client for a bot
   */
  static createClient(botId: string): IWhatsAppClient {
    const sessionManager = this.getSessionManager();
    return sessionManager.createClient(botId);
  }

  /**
   * Get an existing WhatsApp client for a bot
   */
  static getClient(botId: string): IWhatsAppClient | undefined {
    const sessionManager = this.getSessionManager();
    return sessionManager.getClient(botId);
  }

  /**
   * Initialize all WhatsApp clients
   */
  static async initializeAllClients(): Promise<void> {
    const sessionManager = this.getSessionManager();
    await sessionManager.initializeAllClients();
  }

  /**
   * Destroy all WhatsApp clients and clean up resources
   */
  static async destroyAllClients(): Promise<void> {
    const sessionManager = this.getSessionManager();
    await sessionManager.destroyAllClients();
    
    // Clear the singletons
    this.sessionManager = undefined as any;
    this.messageHandler = undefined as any;
  }

  /**
   * Get all active sessions
   */
  static getSessions() {
    const sessionManager = this.getSessionManager();
    return sessionManager.getSessions();
  }

  /**
   * Get the number of active clients
   */
  static getClientCount(): number {
    const sessionManager = this.getSessionManager();
    return sessionManager.getClientCount();
  }

  /**
   * Get clients by state
   */
  static getClientsByState(state: any) {
    const sessionManager = this.getSessionManager();
    return sessionManager.getClientsByState(state);
  }

  /**
   * Gracefully shutdown all WhatsApp services
   */
  static async shutdown(): Promise<void> {
    const sessionManager = this.getSessionManager();
    if (sessionManager) {
      await sessionManager.shutdown();
    }
    
    // Clear the singletons
    this.sessionManager = undefined as any;
    this.messageHandler = undefined as any;
  }
}