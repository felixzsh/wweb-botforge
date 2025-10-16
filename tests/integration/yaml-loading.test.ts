import * as path from 'path';
import { YamlLoader } from '../../src/core/infrastructure/yaml-loader';
import { BotFactory } from '../../src/core/application/bot-factory';

describe('YAML Loading Integration', () => {
  let factory: BotFactory;

  beforeEach(() => {
    factory = new BotFactory();
  });

  describe('Single file approach', () => {
    it('should load and parse main-single.yml correctly', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/main-single.yml'));
      const rawConfig = await loader.loadMainConfig();

      expect(rawConfig).toHaveLength(2);

      const bots = rawConfig.map(config => factory.createFromConfig(config));
      expect(bots).toHaveLength(2);

      // Check first bot
      const soporteBot = bots.find(b => b.id.value === 'soporte-bot');
      expect(soporteBot).toBeDefined();
      expect(soporteBot!.name).toBe('Bot de Soporte');
      expect(soporteBot!.phone?.value).toBe('+521234567890');
      expect(soporteBot!.autoResponses).toHaveLength(1);
      expect(soporteBot!.webhooks).toHaveLength(2);

      // Check second bot
      const ventasBot = bots.find(b => b.id.value === 'ventas-bot');
      expect(ventasBot).toBeDefined();
      expect(ventasBot!.name).toBe('Bot de Ventas');
      expect(ventasBot!.phone).toBeUndefined();
      expect(ventasBot!.autoResponses).toHaveLength(1);
      expect(ventasBot!.webhooks).toHaveLength(0);
    });
  });

  describe('Include approach', () => {
    it('should load and parse main.yml with includes correctly', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/main.yml'));
      const rawConfig = await loader.loadMainConfig();

      expect(rawConfig).toHaveLength(2);

      const bots = rawConfig.map(config => factory.createFromConfig(config));
      expect(bots).toHaveLength(2);

      // Check first bot
      const soporteBot = bots.find(b => b.id.value === 'soporte-bot');
      expect(soporteBot).toBeDefined();
      expect(soporteBot!.name).toBe('Bot de Soporte');
      expect(soporteBot!.phone?.value).toBe('+521234567890');
      expect(soporteBot!.autoResponses).toHaveLength(2); // More responses in include file
      expect(soporteBot!.webhooks).toHaveLength(2);

      // Check second bot
      const ventasBot = bots.find(b => b.id.value === 'ventas-bot');
      expect(ventasBot).toBeDefined();
      expect(ventasBot!.name).toBe('Bot de Ventas');
      expect(ventasBot!.phone).toBeUndefined();
      expect(ventasBot!.autoResponses).toHaveLength(1);
      expect(ventasBot!.webhooks).toHaveLength(0);
    });
  });

  describe('Consistency between approaches', () => {
    it('should produce equivalent Bot objects from both approaches', async () => {
      // Load from single file
      const singleLoader = new YamlLoader(path.join(__dirname, '../fixtures/main-single.yml'));
      const singleRawConfig = await singleLoader.loadMainConfig();
      const singleBots = factory.createBots(singleRawConfig);

      // Load from includes
      const includeLoader = new YamlLoader(path.join(__dirname, '../fixtures/main.yml'));
      const includeRawConfig = await includeLoader.loadMainConfig();
      const includeBots = factory.createBots(includeRawConfig);

      expect(singleBots).toHaveLength(includeBots.length);

      // Sort both arrays by bot ID for comparison
      singleBots.sort((a, b) => a.id.value.localeCompare(b.id.value));
      includeBots.sort((a, b) => a.id.value.localeCompare(b.id.value));

      for (let i = 0; i < singleBots.length; i++) {
        const singleBot = singleBots[i];
        const includeBot = includeBots[i];

        expect(singleBot.id.value).toBe(includeBot.id.value);
        expect(singleBot.name).toBe(includeBot.name);
        expect(singleBot.phone?.value).toBe(includeBot.phone?.value);
        expect(singleBot.settings.simulateTyping).toBe(includeBot.settings.simulateTyping);
        expect(singleBot.settings.queueDelay).toBe(includeBot.settings.queueDelay);
        expect(singleBot.settings.readReceipts).toBe(includeBot.settings.readReceipts);
        expect(singleBot.settings.ignoreGroups).toBe(includeBot.settings.ignoreGroups);
        expect(singleBot.settings.logLevel).toBe(includeBot.settings.logLevel);

        // Note: The include version has more auto responses for soporte-bot
        // This is expected as the fixtures are slightly different
        expect(singleBot.autoResponses.length).toBeLessThanOrEqual(includeBot.autoResponses.length);
        expect(singleBot.webhooks.length).toBe(includeBot.webhooks.length);
      }
    });
  });

  describe('Error handling', () => {
    it('should throw error for missing bots key', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/missing-bots.yml'));
      await expect(loader.loadMainConfig()).rejects.toThrow('Configuration must contain a "bots" array');
    });

    it('should throw error for bots not being an array', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/bots-not-array.yml'));
      await expect(loader.loadMainConfig()).rejects.toThrow('Configuration must contain a "bots" array');
    });

    it('should throw error for bot missing id', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/bot-missing-id.yml'));
      await expect(loader.loadMainConfig()).rejects.toThrow('Each bot must have an "id"');
    });

    it('should throw error for bot missing name', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/bot-missing-name.yml'));
      await expect(loader.loadMainConfig()).rejects.toThrow('must have a "name"');
    });

    it('should throw error for invalid bot id during bot creation', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/invalid-bot-id.yml'));
      const rawConfig = await loader.loadMainConfig();
      expect(() => rawConfig.map(config => factory.createFromConfig(config))).toThrow('Bot ID must be at least 3 characters long');
    });

    it('should throw error for invalid phone number during bot creation', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/invalid-phone.yml'));
      const rawConfig = await loader.loadMainConfig();
      expect(() => rawConfig.map(config => factory.createFromConfig(config))).toThrow('Invalid phone number format');
    });

  });

  describe('Flexible configurations', () => {
    it('should load minimal bot configuration', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/minimal-bot.yml'));
      const rawConfig = await loader.loadMainConfig();

      expect(rawConfig).toHaveLength(1);

      const bots = rawConfig.map(config => factory.createFromConfig(config));
      expect(bots).toHaveLength(1);

      const bot = bots[0];
      expect(bot.id.value).toBe('minimal-bot');
      expect(bot.name).toBe('Minimal Bot');
      expect(bot.phone).toBeUndefined();
      expect(bot.autoResponses).toHaveLength(0);
      expect(bot.webhooks).toHaveLength(0);
      // Check defaults
      expect(bot.settings.simulateTyping).toBe(true);
      expect(bot.settings.queueDelay).toBe(1000);
      expect(bot.settings.readReceipts).toBe(true);
      expect(bot.settings.ignoreGroups).toBe(true);
      expect(bot.settings.adminNumbers).toHaveLength(0);
      expect(bot.settings.logLevel).toBe('info');
    });

    it('should handle camelCase settings', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/camel-case-settings.yml'));
      const rawConfig = await loader.loadMainConfig();

      const bots = rawConfig.map(config => factory.createFromConfig(config));
      const bot = bots[0];

      expect(bot.settings.simulateTyping).toBe(false);
      expect(bot.settings.queueDelay).toBe(2000);
      expect(bot.settings.readReceipts).toBe(false);
      expect(bot.settings.ignoreGroups).toBe(false);
      expect(bot.settings.adminNumbers).toHaveLength(1);
      expect(bot.settings.adminNumbers[0].value).toBe('+521234567891');
      expect(bot.settings.logLevel).toBe('debug');
    });

    it('should ignore extra fields in configuration', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/extra-fields.yml'));
      const rawConfig = await loader.loadMainConfig();

      const bots = rawConfig.map(config => factory.createFromConfig(config));
      expect(bots).toHaveLength(1);

      const bot = bots[0];
      expect(bot.id.value).toBe('extra-bot');
      expect(bot.name).toBe('Bot with extra fields');
      expect(bot.autoResponses).toHaveLength(1);
      expect(bot.autoResponses[0].pattern).toBe('hello');
      expect(bot.autoResponses[0].response).toBe('Hi!');
    });

    it('should handle response_options in auto_responses', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/response-options.yml'));
      const rawConfig = await loader.loadMainConfig();

      const bots = rawConfig.map(config => factory.createFromConfig(config));
      const bot = bots[0];

      expect(bot.autoResponses).toHaveLength(1);
      const response = bot.autoResponses[0];
      expect(response.responseOptions).toBeDefined();
      expect(response.responseOptions!.linkPreview).toBe(true);
      expect(response.responseOptions!.sendAudioAsVoice).toBe(false);
    });
  });
});