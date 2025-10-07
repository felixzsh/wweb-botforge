/**
 * Common WhatsApp Web.js configuration
 */
export class WhatsAppConfig {
  /**
   * Get Puppeteer launch options (always headless)
   */
  static getPuppeteerOptions(): any {
    return {
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