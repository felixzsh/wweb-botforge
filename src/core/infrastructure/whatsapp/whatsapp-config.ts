import { GlobalConfig } from '../../domain/dtos/config.dto';

/**
 * Common WhatsApp Web.js configuration
 */
export class WhatsAppConfig {
  private static globalConfig: GlobalConfig | undefined;

  /**
   * Set global configuration for WhatsApp
   */
  static setGlobalConfig(config: GlobalConfig): void {
    this.globalConfig = config;
  }

  /**
   * Get Puppeteer launch options (always headless)
   */
  static getPuppeteerOptions(): any {
    const chromiumPath = this.globalConfig?.chromiumPath || '/usr/bin/chromium';
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
        '--disable-gpu'
      ]
    };
  }

  /**
   * Get WhatsApp Web.js client options
   */
  static getClientOptions(clientId: string) {
    const { LocalAuth } = require('whatsapp-web.js');
    return {
      authStrategy: new LocalAuth({
        clientId: clientId,
        dataPath: '.wwebjs_auth'
      }),
      puppeteer: this.getPuppeteerOptions()
    };
  }
}