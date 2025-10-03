import { Client, LocalAuth, Message as WWebJSMessage } from 'whatsapp-web.js';
import { 
  IWhatsAppClient, 
  WhatsAppMessage, 
  WhatsAppClientState, 
  WhatsAppSession,
  QRCodeCallback,
  ReadyCallback,
  MessageCallback,
  AuthFailureCallback,
  DisconnectedCallback
} from '../../domain/interfaces/i-whatsapp-client.interface';

/**
 * Concrete implementation of WhatsApp client using whatsapp-web.js
 * This class adapts the external library to our domain interface
 */
export class WhatsAppClient implements IWhatsAppClient {
  private client: Client;
  private session: WhatsAppSession;
  private qrCodeListeners: QRCodeCallback[] = [];
  private readyListeners: ReadyCallback[] = [];
  private messageListeners: MessageCallback[] = [];
  private authFailureListeners: AuthFailureCallback[] = [];
  private disconnectedListeners: DisconnectedCallback[] = [];

  constructor(clientId: string) {
    this.session = {
      clientId,
      state: WhatsAppClientState.DISCONNECTED,
      lastActivity: new Date()
    };

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: clientId,
        dataPath: './sessions'
      }),
      puppeteer: {
        executablePath: '/usr/bin/chromium',
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });

    this.setupEventListeners();
  }

  getState(): WhatsAppClientState {
    return this.session.state;
  }

  getSession(): WhatsAppSession {
    return { ...this.session };
  }

  async initialize(): Promise<void> {
    if (this.session.state !== WhatsAppClientState.DISCONNECTED) {
      throw new Error(`Client is already in state: ${this.session.state}`);
    }

    this.session.state = WhatsAppClientState.CONNECTING;
    await this.client.initialize();
  }

  async sendMessage(to: string, message: string, options?: any): Promise<string> {
    if (this.session.state !== WhatsAppClientState.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const result = await this.client.sendMessage(to, message, options);
      this.session.lastActivity = new Date();
      return result.id._serialized;
    } catch (error) {
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async destroy(): Promise<void> {
    // Remove all event listeners
    this.qrCodeListeners = [];
    this.readyListeners = [];
    this.messageListeners = [];
    this.authFailureListeners = [];
    this.disconnectedListeners = [];

    // Destroy the underlying client
    if (this.client) {
      await this.client.destroy();
    }

    this.session.state = WhatsAppClientState.DISCONNECTED;
  }

  // Event handling methods
  onQRCode(callback: QRCodeCallback): void {
    this.qrCodeListeners.push(callback);
  }

  onReady(callback: ReadyCallback): void {
    this.readyListeners.push(callback);
  }

  onMessage(callback: MessageCallback): void {
    this.messageListeners.push(callback);
  }

  onAuthFailure(callback: AuthFailureCallback): void {
    this.authFailureListeners.push(callback);
  }

  onDisconnected(callback: DisconnectedCallback): void {
    this.disconnectedListeners.push(callback);
  }

  removeQRCodeListener(callback: QRCodeCallback): void {
    this.qrCodeListeners = this.qrCodeListeners.filter(cb => cb !== callback);
  }

  removeReadyListener(callback: ReadyCallback): void {
    this.readyListeners = this.readyListeners.filter(cb => cb !== callback);
  }

  removeMessageListener(callback: MessageCallback): void {
    this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
  }

  removeAuthFailureListener(callback: AuthFailureCallback): void {
    this.authFailureListeners = this.authFailureListeners.filter(cb => cb !== callback);
  }

  removeDisconnectedListener(callback: DisconnectedCallback): void {
    this.disconnectedListeners = this.disconnectedListeners.filter(cb => cb !== callback);
  }

  private setupEventListeners(): void {
    // QR Code event
    this.client.on('qr', (qr: string) => {
      this.session.qrCode = qr;
      this.session.state = WhatsAppClientState.AUTHENTICATING;
      this.qrCodeListeners.forEach(callback => callback(qr));
    });

    // Ready event
    this.client.on('ready', async () => {
      this.session.state = WhatsAppClientState.READY;
      
      // Get phone number from the client
      try {
        const info = this.client.info;
        this.session.phoneNumber = info.wid.user;
      } catch (error) {
        console.warn('Could not retrieve phone number from WhatsApp client');
      }

      this.session.lastActivity = new Date();
      this.readyListeners.forEach(callback => callback());
    });

    // Message event
    this.client.on('message', (message: WWebJSMessage) => {
      const whatsappMessage: WhatsAppMessage = {
        id: message.id._serialized,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: new Date(message.timestamp * 1000),
        hasMedia: message.hasMedia,
        type: message.type,
        fromMe: message.fromMe
      };

      this.session.lastActivity = new Date();
      this.messageListeners.forEach(callback => callback(whatsappMessage));
    });

    // Authentication failure event
    this.client.on('auth_failure', (error: any) => {
      this.session.state = WhatsAppClientState.FAILED;
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.authFailureListeners.forEach(callback => callback(errorObj));
    });

    // Disconnected event
    this.client.on('disconnected', (reason: string) => {
      this.session.state = WhatsAppClientState.DISCONNECTED;
      this.disconnectedListeners.forEach(callback => callback(reason));
    });
  }
}