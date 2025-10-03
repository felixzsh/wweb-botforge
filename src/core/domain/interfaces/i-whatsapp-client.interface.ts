import { Message, ClientSession } from 'whatsapp-web.js';

/**
 * Represents a WhatsApp message received by the bot
 */
export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
  hasMedia: boolean;
  type: string;
  fromMe: boolean;
}

/**
 * Represents the state of a WhatsApp client
 */
export enum WhatsAppClientState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
  READY = 'ready',
  FAILED = 'failed'
}

/**
 * Represents a WhatsApp session
 */
export interface WhatsAppSession {
  clientId: string;
  state: WhatsAppClientState;
  phoneNumber?: string;
  lastActivity?: Date;
  qrCode?: string;
}

/**
 * Callback types for WhatsApp client events
 */
export type QRCodeCallback = (qrCode: string) => void;
export type ReadyCallback = () => void;
export type MessageCallback = (message: WhatsAppMessage) => void;
export type AuthFailureCallback = (error: Error) => void;
export type DisconnectedCallback = (reason: string) => void;

/**
 * Main interface for WhatsApp client operations
 * This abstracts the whatsapp-web.js library from the domain
 */
export interface IWhatsAppClient {
  /**
   * Get the current state of the client
   */
  getState(): WhatsAppClientState;

  /**
   * Get the session information
   */
  getSession(): WhatsAppSession;

  /**
   * Initialize the WhatsApp client
   */
  initialize(): Promise<void>;

  /**
   * Send a message to a specific chat
   */
  sendMessage(to: string, message: string, options?: any): Promise<string>;

  /**
   * Destroy the client and clean up resources
   */
  destroy(): Promise<void>;

  /**
   * Event handlers
   */
  onQRCode(callback: QRCodeCallback): void;
  onReady(callback: ReadyCallback): void;
  onMessage(callback: MessageCallback): void;
  onAuthFailure(callback: AuthFailureCallback): void;
  onDisconnected(callback: DisconnectedCallback): void;

  /**
   * Remove event listeners
   */
  removeQRCodeListener(callback: QRCodeCallback): void;
  removeReadyListener(callback: ReadyCallback): void;
  removeMessageListener(callback: MessageCallback): void;
  removeAuthFailureListener(callback: AuthFailureCallback): void;
  removeDisconnectedListener(callback: DisconnectedCallback): void;
}

/**
 * Interface for managing multiple WhatsApp sessions
 */
export interface IWhatsAppSessionManager {
  /**
   * Create a new WhatsApp client for a bot
   */
  createClient(botId: string): IWhatsAppClient;

  /**
   * Get an existing WhatsApp client by bot ID
   */
  getClient(botId: string): IWhatsAppClient | undefined;

  /**
   * Get all active WhatsApp clients
   */
  getAllClients(): Map<string, IWhatsAppClient>;

  /**
   * Destroy a specific WhatsApp client
   */
  destroyClient(botId: string): Promise<void>;

  /**
   * Destroy all WhatsApp clients
   */
  destroyAllClients(): Promise<void>;

  /**
   * Get all active sessions
   */
  getSessions(): WhatsAppSession[];

  /**
   * Get client by phone number
   */
  getClientByPhoneNumber(phoneNumber: string): IWhatsAppClient | undefined;

  /**
   * Check if a client exists for the given bot ID
   */
  hasClient(botId: string): boolean;

  /**
   * Get the number of active clients
   */
  getClientCount(): number;

  /**
   * Get clients by state
   */
  getClientsByState(state: WhatsAppSession['state']): IWhatsAppClient[];

  /**
   * Initialize all clients
   */
  initializeAllClients(): Promise<void>;

  /**
   * Gracefully shutdown all clients
   */
  shutdown(): Promise<void>;
}