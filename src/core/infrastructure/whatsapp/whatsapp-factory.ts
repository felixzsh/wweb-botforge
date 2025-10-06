import { IChatClient, IChatSessionManager } from '../../domain/entities/chat.entity';
import { IChatFactory } from '../../domain/interfaces/chat-factory.interface';
import { WhatsAppClient } from './whatsapp-client';
import { WhatsAppSessionManager } from './whatsapp-session-manager';
import { ChatMessageHandler } from './whatsapp-message-handler';

/**
 * Factory class for creating and managing WhatsApp infrastructure components
 * This provides a centralized way to create and coordinate all WhatsApp-related services
 */
export class WhatsAppFactory implements IChatFactory {
  private static instance: WhatsAppFactory;
  private sessionManager: IChatSessionManager;
  private messageHandler: ChatMessageHandler;

  private constructor() {
    this.sessionManager = new WhatsAppSessionManager();
    this.messageHandler = new ChatMessageHandler();
  }

  static getInstance(): WhatsAppFactory {
    if (!this.instance) {
      this.instance = new WhatsAppFactory();
    }
    return this.instance;
  }

  /**
   * Create a new WhatsApp client for a bot
   */
  createClient(botId: string): IChatClient {
    return this.sessionManager.createClient(botId);
  }

  /**
   * Get an existing WhatsApp client for a bot
   */
  getClient(botId: string): IChatClient | undefined {
    return this.sessionManager.getClient(botId);
  }

  /**
   * Destroy all WhatsApp clients and clean up resources
   */
  async destroyAllClients(): Promise<void> {
    await this.sessionManager.destroyAllClients();
  }

  /**
   * Get or create the session manager singleton
   */
  getSessionManager(): IChatSessionManager {
    return this.sessionManager;
  }

  /**
   * Get or create the message handler singleton
   */
  getMessageHandler(): ChatMessageHandler {
    return this.messageHandler;
  }

  /**
   * Initialize all WhatsApp clients
   */
  async initializeAllClients(): Promise<void> {
    await this.sessionManager.initializeAllClients();
  }

  /**
   * Get all active sessions
   */
  getSessions() {
    return this.sessionManager.getSessions();
  }

  /**
   * Get the number of active clients
   */
  getClientCount(): number {
    return this.sessionManager.getClientCount();
  }

  /**
   * Get clients by state
   */
  getClientsByState(state: any) {
    return this.sessionManager.getClientsByState(state);
  }

  /**
   * Gracefully shutdown all WhatsApp services
   */
  async shutdown(): Promise<void> {
    if (this.sessionManager) {
      await this.sessionManager.shutdown();
    }
  }

  // Static methods for backward compatibility
  static createClient(botId: string): IChatClient {
    return this.getInstance().createClient(botId);
  }

  static getClient(botId: string): IChatClient | undefined {
    return this.getInstance().getClient(botId);
  }

  static async destroyAllClients(): Promise<void> {
    await this.getInstance().destroyAllClients();
  }

  static getSessionManager(): IChatSessionManager {
    return this.getInstance().getSessionManager();
  }

  static getMessageHandler(): ChatMessageHandler {
    return this.getInstance().getMessageHandler();
  }

  static async initializeAllClients(): Promise<void> {
    await this.getInstance().initializeAllClients();
  }

  static getSessions() {
    return this.getInstance().getSessions();
  }

  static getClientCount(): number {
    return this.getInstance().getClientCount();
  }

  static getClientsByState(state: any) {
    return this.getInstance().getClientsByState(state);
  }

  static async shutdown(): Promise<void> {
    await this.getInstance().shutdown();
  }
}