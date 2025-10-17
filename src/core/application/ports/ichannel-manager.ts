import { IMessageChannel } from '../../domain/ports/imessage-channel';

/**
 * Interface for managing multiple message channels
 * This abstraction allows the domain to work with multiple channels
 * without knowing the specific implementation details
 */
export interface IChannelManager {
  createChannel(id: string): IMessageChannel;
  getChannel(id: string): IMessageChannel | undefined;
  getAllChannels(): Map<string, IMessageChannel>;
  removeChannel(id: string): Promise<void>;
  removeAllChannels(): Promise<void>;
  hasChannel(id: string): boolean;
  getChannelCount(): number;
}