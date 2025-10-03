import { 
  IWhatsAppSessionManager, 
  IWhatsAppClient, 
  WhatsAppSession 
} from '../../domain/interfaces/i-whatsapp-client.interface';
import { WhatsAppClient } from './whatsapp-client';

/**
 * Manages multiple WhatsApp client sessions
 * This class is responsible for creating, storing, and managing multiple WhatsApp clients
 */
export class WhatsAppSessionManager implements IWhatsAppSessionManager {
  private clients: Map<string, IWhatsAppClient> = new Map();

  createClient(botId: string): IWhatsAppClient {
    if (this.clients.has(botId)) {
      throw new Error(`WhatsApp client for bot '${botId}' already exists`);
    }

    const client = new WhatsAppClient(botId);
    this.clients.set(botId, client);
    
    return client;
  }

  getClient(botId: string): IWhatsAppClient | undefined {
    return this.clients.get(botId);
  }

  getAllClients(): Map<string, IWhatsAppClient> {
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

  getSessions(): WhatsAppSession[] {
    return Array.from(this.clients.values()).map(client => client.getSession());
  }

  /**
   * Get client by phone number
   */
  getClientByPhoneNumber(phoneNumber: string): IWhatsAppClient | undefined {
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
  getClientsByState(state: WhatsAppSession['state']): IWhatsAppClient[] {
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