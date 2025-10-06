/**
 * Represents a chat message received by the bot
 */
export interface ChatMessage {
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
 * Represents the state of a chat client
 */
export enum ChatClientState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
  READY = 'ready',
  FAILED = 'failed'
}

/**
 * Represents a chat session
 */
export interface ChatSession {
  clientId: string;
  state: ChatClientState;
  phoneNumber?: string;
  lastActivity?: Date;
  qrCode?: string;
}

/**
 * Callback types for chat client events
 */
export type QRCodeCallback = (qrCode: string) => void;
export type ReadyCallback = () => void;
export type MessageCallback = (message: ChatMessage) => void;
export type AuthFailureCallback = (error: Error) => void;
export type DisconnectedCallback = (reason: string) => void;

/**
 * Main interface for chat client operations
 * This abstracts the chat provider library from the domain
 */
export interface IChatClient {
  getState(): ChatClientState;
  getSession(): ChatSession;
  initialize(): Promise<void>;
  sendMessage(to: string, message: string, options?: any): Promise<string>;
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
 * Interface for managing multiple chat sessions
 */
export interface IChatSessionManager {
  createClient(botId: string): IChatClient;
  getClient(botId: string): IChatClient | undefined;
  getAllClients(): Map<string, IChatClient>;
  destroyClient(botId: string): Promise<void>;
  destroyAllClients(): Promise<void>;
  getSessions(): ChatSession[];
  getClientByPhoneNumber(phoneNumber: string): IChatClient | undefined;
  hasClient(botId: string): boolean;
  getClientCount(): number;
  getClientsByState(state: ChatSession['state']): IChatClient[];
  initializeAllClients(): Promise<void>;
  shutdown(): Promise<void>;
}