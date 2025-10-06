import { IChatClient } from './chat-client.interface';

export interface IChatFactory {
  createClient(botId: string): IChatClient;
  getClient(botId: string): IChatClient | undefined;
  destroyAllClients(): Promise<void>;
}