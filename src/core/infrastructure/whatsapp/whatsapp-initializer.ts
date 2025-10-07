import { Client } from 'whatsapp-web.js';
import { WhatsAppUtils } from './whatsapp-types';
import { WhatsAppConfig } from './whatsapp-config';

export type QRCodeHandler = (qr: string) => void;
export type AuthSuccessHandler = (phoneNumber: string) => void;
export type AuthFailureHandler = (error: Error) => void;

/**
 * Handles WhatsApp initialization and authentication process
 * This is used primarily by the create-bot command to set up new WhatsApp sessions
 */
export class WhatsAppInitializer {
  private client: Client;
  private qrHandler?: QRCodeHandler;
  private successHandler?: AuthSuccessHandler;
  private failureHandler?: AuthFailureHandler;

  constructor(clientId: string) {
    this.client = new Client(WhatsAppConfig.getClientOptions(clientId));

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('qr', (qr: string) => {
      if (this.qrHandler) {
        this.qrHandler(qr);
      }
    });

    this.client.on('ready', async () => {
      try {
        const info = this.client.info;
        // Convert ContactId to string by accessing the _serialized property
        const phoneNumber = WhatsAppUtils.widToPhoneNumber(info.wid._serialized);
        
        if (this.successHandler) {
          this.successHandler(phoneNumber);
        }
      } catch (error) {
        if (this.failureHandler) {
          this.failureHandler(new Error('Failed to get phone number after authentication'));
        }
      }
    });

    this.client.on('auth_failure', (error: any) => {
      if (this.failureHandler) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        this.failureHandler(errorObj);
      }
    });
  }

  /**
   * Start the initialization process
   */
  async initialize(): Promise<void> {
    await this.client.initialize();
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
    }
  }

  /**
   * Event handlers
   */
  onQRCode(handler: QRCodeHandler): void {
    this.qrHandler = handler;
  }

  onAuthSuccess(handler: AuthSuccessHandler): void {
    this.successHandler = handler;
  }

  onAuthFailure(handler: AuthFailureHandler): void {
    this.failureHandler = handler;
  }
}
