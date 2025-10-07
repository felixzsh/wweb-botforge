import { Client } from 'whatsapp-web.js';
import {
  MessageChannel,
  IncomingMessage,
  OutgoingMessage,
  MessageHandler,
  ReadyHandler,
  DisconnectedHandler,
  AuthFailureHandler,
  ConnectionErrorHandler,
  StateChangeHandler
} from '../../domain/entities/channel.entity';
import { WhatsAppMessageAdapter } from './whatsapp-message-adapter';
import { WhatsAppConnectionState } from './whatsapp-types';
import { WhatsAppConfig } from './whatsapp-config';

export class WhatsAppChannel implements MessageChannel {
  private client: Client;
  private messageHandlers: MessageHandler[] = [];
  private readyHandlers: ReadyHandler[] = [];
  private disconnectedHandlers: DisconnectedHandler[] = [];
  private authFailureHandlers: AuthFailureHandler[] = [];
  private connectionErrorHandlers: ConnectionErrorHandler[] = [];
  private stateChangeHandlers: StateChangeHandler[] = [];
  private isConnected: boolean = false;

  constructor(clientId: string) {
    this.client = new Client(WhatsAppConfig.getClientOptions(clientId));

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Ready event
    this.client.on('ready', () => {
      this.isConnected = true;
      this.readyHandlers.forEach(handler => handler());
    });

    // Message event
    this.client.on('message', msg => {
      const domainMessage = WhatsAppMessageAdapter.toDomainMessage(msg);
      this.messageHandlers.forEach(handler => handler(domainMessage));
    });

    // Disconnected event
    this.client.on('disconnected', reason => {
      this.isConnected = false;
      this.disconnectedHandlers.forEach(handler => handler(reason));
    });

    // Auth failure event
    this.client.on('auth_failure', (msg: any) => {
      const error = new Error(typeof msg === 'string' ? msg : 'Authentication failed');
      this.authFailureHandlers.forEach(handler => handler(error));
    });

    // Connection error event
    this.client.on('connection_error', (error: Error) => {
      this.connectionErrorHandlers.forEach(handler => handler(error));
    });

    // State change event
    this.client.on('change_state', state => {
      const domainState = this.mapWhatsAppState(state);
      this.stateChangeHandlers.forEach(handler => handler(domainState));
    });
  }

  private mapWhatsAppState(state: any): string {
    switch (state) {
      case WhatsAppConnectionState.CONNECTED:
        return 'connected';
      case WhatsAppConnectionState.CONNECTING:
        return 'connecting';
      case WhatsAppConnectionState.DISCONNECTED:
        return 'disconnected';
      case WhatsAppConnectionState.AUTHENTICATING:
        return 'authenticating';
      default:
        return 'unknown';
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      throw new Error('Channel is already connected');
    }
    await this.client.initialize();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.isConnected = false;
    }
  }

  async send(message: OutgoingMessage): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Channel is not connected');
    }

    const whatsappMsg = WhatsAppMessageAdapter.toWhatsAppFormat(message);
    const result = await this.client.sendMessage(
      whatsappMsg.to,
      whatsappMsg.content,
      whatsappMsg.options
    );

    return result.id._serialized;
  }

  // Event handler registration
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onReady(handler: ReadyHandler): void {
    this.readyHandlers.push(handler);
  }

  onDisconnected(handler: DisconnectedHandler): void {
    this.disconnectedHandlers.push(handler);
  }

  onAuthFailure(handler: AuthFailureHandler): void {
    this.authFailureHandlers.push(handler);
  }

  onConnectionError(handler: ConnectionErrorHandler): void {
    this.connectionErrorHandlers.push(handler);
  }

  onStateChange(handler: StateChangeHandler): void {
    this.stateChangeHandlers.push(handler);
  }

  // Event handler removal
  removeMessageHandler(handler: MessageHandler): void {
    this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
  }

  removeReadyHandler(handler: ReadyHandler): void {
    this.readyHandlers = this.readyHandlers.filter(h => h !== handler);
  }

  removeDisconnectedHandler(handler: DisconnectedHandler): void {
    this.disconnectedHandlers = this.disconnectedHandlers.filter(h => h !== handler);
  }

  removeAuthFailureHandler(handler: AuthFailureHandler): void {
    this.authFailureHandlers = this.authFailureHandlers.filter(h => h !== handler);
  }

  removeConnectionErrorHandler(handler: ConnectionErrorHandler): void {
    this.connectionErrorHandlers = this.connectionErrorHandlers.filter(h => h !== handler);
  }

  removeStateChangeHandler(handler: StateChangeHandler): void {
    this.stateChangeHandlers = this.stateChangeHandlers.filter(h => h !== handler);
  }
}