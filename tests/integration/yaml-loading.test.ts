import * as path from 'path';
import { YamlLoader } from '../../src/core/infrastructure/yaml-loader';
import { BotFactory } from '../../src/core/infrastructure/bot-factory';

describe('YAML Loading Integration', () => {
  let factory: BotFactory;

  beforeEach(() => {
    factory = new BotFactory();
  });

  describe('Single file approach', () => {
    it('should load and parse main-single.yml correctly', async () => {
      const loader = new YamlLoader(path.join(__dirname, '../fixtures/main-single.yml'));
      const rawConfig = await loader.loadMainConfig();

      expect(rawConfig.bots).toHaveLength(2);

      const bots = factory.createBots(rawConfig);
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

      expect(rawConfig.bots).toHaveLength(2);

      const bots = factory.createBots(rawConfig);
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
        expect(singleBot.settings.typingDelay).toBe(includeBot.settings.typingDelay);
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
});
