export interface IncomingMessage {
  id: string
  from: string
  to: string
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface OutgoingMessage {
  to: string
  content: string
  metadata?: Record<string, any>
}

export interface AuthRequiredInfo {
  channelId: string
  method: string
  data?: string
}

export interface MessageChannel {
  send(message: OutgoingMessage): Promise<string>
  onMessage(handler: (message: IncomingMessage) => void | Promise<void>): void
  onReady(handler: () => void | Promise<void>): void
  onDisconnected(handler: (reason: string) => void | Promise<void>): void
  onAuthFailure(handler: (error: Error) => void | Promise<void>): void
  onConnectionError(handler: (error: Error) => void | Promise<void>): void
  onStateChange(handler: (newState: string) => void | Promise<void>): void
  onAuthRequired?(handler: (info: AuthRequiredInfo) => void | Promise<void>): void
  connect(): Promise<void>
  disconnect(): Promise<void>
  getPhone(): string | undefined
}

export type SessionState = 'pending' | 'qr_received' | 'connected' | 'disconnected' | 'auth_failure'

export interface SessionEvent {
  type: 'qr' | 'ready' | 'disconnected' | 'auth_failure'
  data?: unknown
}

export interface SessionInfo {
  state: SessionState
  phone?: string
  lastQR?: string
  error?: string
}

export interface WebhookPayload {
  sender: string
  message: string
  timestamp: string
  botId: string
  botName: string
  webhookName: string
  metadata: Record<string, any>
}
