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