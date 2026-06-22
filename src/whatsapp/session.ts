import { MessageChannel } from '../messaging/contracts'
import { WhatsAppChannel } from './client'

export class SessionManager {
  private static instance: SessionManager
  private channels: Map<string, WhatsAppChannel>

  private constructor() {
    this.channels = new Map()
  }

  static getInstance(): SessionManager {
    if (!this.instance) {
      this.instance = new SessionManager()
    }
    return this.instance
  }

  createChannel(id: string): MessageChannel {
    if (this.channels.has(id)) {
      throw new Error(`Channel already exists for ID ${id}`)
    }

    const channel = new WhatsAppChannel(id)
    this.channels.set(id, channel)
    return channel
  }

  getChannel(id: string): MessageChannel | undefined {
    return this.channels.get(id)
  }

  getAllChannels(): Map<string, MessageChannel> {
    return new Map(this.channels)
  }

  async removeChannel(id: string): Promise<void> {
    const channel = this.channels.get(id)
    if (channel) {
      await channel.disconnect()
      this.channels.delete(id)
    }
  }

  async removeAllChannels(): Promise<void> {
    const disconnectPromises = Array.from(this.channels.values()).map(channel => channel.disconnect())
    await Promise.all(disconnectPromises)
    this.channels.clear()
  }

  getChannelCount(): number {
    return this.channels.size
  }

  hasChannel(id: string): boolean {
    return this.channels.has(id)
  }
}
