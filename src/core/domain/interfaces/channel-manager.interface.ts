import { MessageChannel } from '../entities/channel.entity';

/**
 * Interface for managing multiple message channels
 * This abstraction allows the domain to work with multiple channels
 * without knowing the specific implementation details
 */
export interface IChannelManager {
  createChannel(id: string): MessageChannel;
  getChannel(id: string): MessageChannel | undefined;
  getAllChannels(): Map<string, MessageChannel>;
  removeChannel(id: string): Promise<void>;
  removeAllChannels(): Promise<void>;
  hasChannel(id: string): boolean;
  getChannelCount(): number;
}