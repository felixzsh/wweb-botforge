import { MessageChannel } from '../../domain/ports/channel.entity';
import { IChannelManager } from '../../domain/ports/channel-manager';
import { WhatsAppChannel } from './whatsapp-channel';

/**
 * Manages WhatsApp channel sessions
 * Implements the domain's IChannelManager interface
 */
export class WhatsAppSessionManager implements IChannelManager {
  private static instance: WhatsAppSessionManager;
  private channels: Map<string, WhatsAppChannel>;

  private constructor() {
    this.channels = new Map();
  }

  static getInstance(): WhatsAppSessionManager {
    if (!this.instance) {
      this.instance = new WhatsAppSessionManager();
    }
    return this.instance;
  }

  /**
   * Create a new WhatsApp channel
   */
  createChannel(id: string): MessageChannel {
    if (this.channels.has(id)) {
      throw new Error(`Channel already exists for ID ${id}`);
    }

    const channel = new WhatsAppChannel(id);
    this.channels.set(id, channel);
    return channel;
  }

  /**
   * Get an existing WhatsApp channel
   */
  getChannel(id: string): MessageChannel | undefined {
    return this.channels.get(id);
  }

  /**
   * Get all active channels
   */
  getAllChannels(): Map<string, MessageChannel> {
    return new Map(this.channels);
  }

  /**
   * Remove a channel
   */
  async removeChannel(id: string): Promise<void> {
    const channel = this.channels.get(id);
    if (channel) {
      await channel.disconnect();
      this.channels.delete(id);
    }
  }

  /**
   * Remove all channels
   */
  async removeAllChannels(): Promise<void> {
    const disconnectPromises = Array.from(this.channels.values()).map(
      channel => channel.disconnect()
    );
    await Promise.all(disconnectPromises);
    this.channels.clear();
  }

  /**
   * Get the number of active channels
   */
  getChannelCount(): number {
    return this.channels.size;
  }

  /**
   * Check if a channel exists
   */
  hasChannel(id: string): boolean {
    return this.channels.has(id);
  }
}