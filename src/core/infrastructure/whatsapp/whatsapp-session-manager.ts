import {
  IChatSessionManager,
  IChatClient,
  ChatSession
} from '../../domain/entities/chat.entity';
import { WhatsAppClient } from './whatsapp-client';

/**
 * Manages multiple chat client sessions
 * This class is responsible for creating, storing, and managing multiple chat clients
 */
export class WhatsAppSessionManager implements IChatSessionManager {
  private clients: Map<string, IChatClient> = new Map();

  createClient(botId: string): IChatClient {
    if (this.clients.has(botId)) {
      throw new Error(`WhatsApp client for bot '${botId}' already exists`);
    }

    const client = new WhatsAppClient(botId);
    this.clients.set(botId, client);
    
    return client;
  }

  getClient(botId: string): IChatClient | undefined {
    return this.clients.get(botId);
  }

  getAllClients(): Map<string, IChatClient> {
    return new Map(this.clients);
  }

  async destroyClient(botId: string): Promise<void> {
    const client = this.clients.get(botId);
    if (client) {
      await client.destroy();
      this.clients.delete(botId);
    }
  }

  async destroyAllClients(): Promise<void> {
    const destroyPromises = Array.from(this.clients.keys()).map(botId => 
      this.destroyClient(botId)
    );
    await Promise.allSettled(destroyPromises);
  }

  getSessions(): ChatSession[] {
    return Array.from(this.clients.values()).map(client => client.getSession());
  }

  /**
   * Get client by phone number
   */
  getClientByPhoneNumber(phoneNumber: string): IChatClient | undefined {
    for (const client of this.clients.values()) {
      const session = client.getSession();
      if (session.phoneNumber === phoneNumber) {
        return client;
      }
    }
    return undefined;
  }

  /**
   * Check if a client exists for the given bot ID
   */
  hasClient(botId: string): boolean {
    return this.clients.has(botId);
  }

  /**
   * Get the number of active clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients by state
   */
  getClientsByState(state: ChatSession['state']): IChatClient[] {
    return Array.from(this.clients.values()).filter(
      client => client.getState() === state
    );
  }

  /**
   * Initialize all clients
   */
  async initializeAllClients(): Promise<void> {
    const initializePromises = Array.from(this.clients.values()).map(client => 
      client.initialize().catch(error => {
        console.error(`Failed to initialize client: ${error.message}`);
        return Promise.resolve(); // Don't throw, just log and continue
      })
    );
    await Promise.all(initializePromises);
  }

  /**
   * Gracefully shutdown all clients
   */
  async shutdown(): Promise<void> {
    await this.destroyAllClients();
  }
}