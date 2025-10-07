/**
 * Represents a message received through the channel
 */
export interface IncomingMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Represents a message to be sent through the channel
 */
export interface OutgoingMessage {
  to: string;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * Core event handlers for message channels
 */
export type MessageHandler = (message: IncomingMessage) => void | Promise<void>;
export type ReadyHandler = () => void | Promise<void>;
export type DisconnectedHandler = (reason: string) => void | Promise<void>;
export type AuthFailureHandler = (error: Error) => void | Promise<void>;
export type ConnectionErrorHandler = (error: Error) => void | Promise<void>;
export type StateChangeHandler = (newState: string) => void | Promise<void>;

/**
 * Represents a bidirectional communication channel
 * This is the core abstraction that any chat provider must implement
 */
export interface MessageChannel {
  /**
   * Send a message through this channel
   */
  send(message: OutgoingMessage): Promise<string>;

  /**
   * Core event handlers
   */
  onMessage(handler: MessageHandler): void;
  onReady(handler: ReadyHandler): void;
  onDisconnected(handler: DisconnectedHandler): void;
  onAuthFailure(handler: AuthFailureHandler): void;
  onConnectionError(handler: ConnectionErrorHandler): void;
  onStateChange(handler: StateChangeHandler): void;

  /**
   * Remove event handlers
   */
  removeMessageHandler(handler: MessageHandler): void;
  removeReadyHandler(handler: ReadyHandler): void;
  removeDisconnectedHandler(handler: DisconnectedHandler): void;
  removeAuthFailureHandler(handler: AuthFailureHandler): void;
  removeConnectionErrorHandler(handler: ConnectionErrorHandler): void;
  removeStateChangeHandler(handler: StateChangeHandler): void;

  /**
   * Lifecycle methods
   */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}