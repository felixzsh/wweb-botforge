import { Client, LocalAuth } from 'whatsapp-web.js'
import { IncomingMessage, OutgoingMessage, MessageChannel } from '../messaging/contracts'
import { Bot } from '../bot/bot'
import { ConfigFile } from '../config/schema'
import { toDomainMessage, toWhatsAppFormat, WhatsAppConnectionState, widToPhoneNumber } from './whatsapp'
import { getLogger } from '../utils/logger'

let globalConfig: ConfigFile['global'] | undefined

export function setGlobalConfig(config: ConfigFile['global']): void {
  globalConfig = config
}

export function getPuppeteerOptions(): any {
  const chromiumPath = globalConfig?.chromiumPath || '/usr/bin/chromium'
  return {
    executablePath: chromiumPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
    ],
  }
}

export function getClientOptions(clientId: string) {
  return {
    authStrategy: new LocalAuth({
      clientId: clientId,
      dataPath: '.wwebjs_auth',
    }),
    puppeteer: getPuppeteerOptions(),
  }
}

type MessageHandler = (message: IncomingMessage) => void | Promise<void>
type ReadyHandler = () => void | Promise<void>
type DisconnectedHandler = (reason: string) => void | Promise<void>
type AuthFailureHandler = (error: Error) => void | Promise<void>
type ConnectionErrorHandler = (error: Error) => void | Promise<void>
type StateChangeHandler = (newState: string) => void | Promise<void>

export class WhatsAppChannel implements MessageChannel {
  private client: Client
  private messageHandlers: MessageHandler[] = []
  private readyHandlers: ReadyHandler[] = []
  private disconnectedHandlers: DisconnectedHandler[] = []
  private authFailureHandlers: AuthFailureHandler[] = []
  private connectionErrorHandlers: ConnectionErrorHandler[] = []
  private stateChangeHandlers: StateChangeHandler[] = []
  private isConnected: boolean = false
  private phoneNumber?: string

  constructor(clientId: string) {
    this.client = new Client(getClientOptions(clientId))
    this.setupEventListeners()
  }

  private get logger() {
    return getLogger()
  }

  private setupEventListeners(): void {
    this.client.on('ready', () => {
      this.isConnected = true
      if (this.client.info?.wid) {
        this.phoneNumber = widToPhoneNumber(this.client.info.wid._serialized)
      }
      this.readyHandlers.forEach(handler => handler())
    })

    this.client.on('message', msg => {
      const domainMessage = toDomainMessage(msg)
      this.messageHandlers.forEach(handler => handler(domainMessage))
    })

    this.client.on('disconnected', reason => {
      this.isConnected = false
      this.disconnectedHandlers.forEach(handler => handler(reason))
    })

    this.client.on('auth_failure', (msg: any) => {
      const error = new Error(typeof msg === 'string' ? msg : 'Authentication failed')
      this.authFailureHandlers.forEach(handler => handler(error))
    })

    this.client.on('connection_error', (error: Error) => {
      this.connectionErrorHandlers.forEach(handler => handler(error))
    })

    this.client.on('change_state', state => {
      const domainState = this.mapWhatsAppState(state)
      this.stateChangeHandlers.forEach(handler => handler(domainState))
    })
  }

  private mapWhatsAppState(state: any): string {
    switch (state) {
      case WhatsAppConnectionState.CONNECTED:
        return 'connected'
      case WhatsAppConnectionState.CONNECTING:
        return 'connecting'
      case WhatsAppConnectionState.DISCONNECTED:
        return 'disconnected'
      case WhatsAppConnectionState.AUTHENTICATING:
        return 'authenticating'
      default:
        return 'unknown'
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      throw new Error('Channel is already connected')
    }
    await this.client.initialize()
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.destroy()
      this.isConnected = false
    }
  }

  async send(message: OutgoingMessage): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Channel is not connected')
    }

    const whatsappMsg = toWhatsAppFormat(message)
    this.logger.debug('WhatsApp send options:', JSON.stringify(whatsappMsg.options, null, 2))

    const result = await this.client.sendMessage(
      whatsappMsg.to,
      whatsappMsg.content,
      whatsappMsg.options
    )

    return result.id._serialized
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler)
  }

  onReady(handler: ReadyHandler): void {
    this.readyHandlers.push(handler)
  }

  onDisconnected(handler: DisconnectedHandler): void {
    this.disconnectedHandlers.push(handler)
  }

  onAuthFailure(handler: AuthFailureHandler): void {
    this.authFailureHandlers.push(handler)
  }

  onConnectionError(handler: ConnectionErrorHandler): void {
    this.connectionErrorHandlers.push(handler)
  }

  onStateChange(handler: StateChangeHandler): void {
    this.stateChangeHandlers.push(handler)
  }

  getPhone(): string | undefined {
    return this.phoneNumber
  }
}

export class WhatsAppInitializer {
  private client: Client
  private qrHandler?: (qr: string) => void
  private successHandler?: (phoneNumber: string) => void
  private failureHandler?: (error: Error) => void

  constructor(clientId: string) {
    this.client = new Client(getClientOptions(clientId))
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    this.client.on('qr', (qr: string) => {
      if (this.qrHandler) {
        this.qrHandler(qr)
      }
    })

    this.client.on('ready', async () => {
      try {
        const info = this.client.info
        const phoneNumber = widToPhoneNumber(info.wid._serialized)

        if (this.successHandler) {
          this.successHandler(phoneNumber)
        }
      } catch (error) {
        if (this.failureHandler) {
          this.failureHandler(new Error('Failed to get phone number after authentication'))
        }
      }
    })

    this.client.on('auth_failure', (error: any) => {
      if (this.failureHandler) {
        const errorObj = error instanceof Error ? error : new Error(String(error))
        this.failureHandler(errorObj)
      }
    })
  }

  async initialize(): Promise<void> {
    await this.client.initialize()
  }

  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.destroy()
    }
  }

  onQRCode(handler: (qr: string) => void): void {
    this.qrHandler = handler
  }

  onAuthSuccess(handler: (phoneNumber: string) => void): void {
    this.successHandler = handler
  }

  onAuthFailure(handler: (error: Error) => void): void {
    this.failureHandler = handler
  }
}
