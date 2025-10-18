import * as path from 'path';
import { YamlConfigRepository } from '../../src/core/infrastructure/adapters/yaml-config.repository';
import { BotConfigMapper } from '../../src/core/application/mappers/bot-config.mapper';
import { ConfigFileDTO } from '../../src/core/application/dtos/config-file.dto';

describe('YAML Configuration Loading Integration Tests', () => {
  let repository: YamlConfigRepository;

  describe('Valid Configuration Files', () => {
    describe('Minimal Bot Configuration', () => {
      it('should load minimal bot configuration successfully', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/minimal-bot.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();

        expect(config).toBeDefined();
        expect(config.bots).toBeDefined();
        expect(config.bots).toHaveLength(1);
        expect(config.bots[0].id).toBe('minimal-bot');
        expect(config.bots[0].name).toBe('Minimal Bot');
      });

      it('should map minimal bot to domain entity', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/minimal-bot.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const bot = BotConfigMapper.toDomain(config.bots[0]);

        expect(bot).toBeDefined();
        expect(bot.id.value).toBe('minimal-bot');
        expect(bot.name).toBe('Minimal Bot');
        expect(bot.autoResponses).toHaveLength(0);
        expect(bot.webhooks).toHaveLength(0);
        expect(bot.phone).toBeUndefined();
      });
    });

    describe('Single File Configuration (main-single.yml)', () => {
      it('should load main-single.yml with multiple bots', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main-single.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();

        expect(config).toBeDefined();
        expect(config.bots).toHaveLength(2);
      });

      it('should load soporte-bot correctly from main-single.yml', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main-single.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const soporteBotConfig = config.bots.find(b => b.id === 'soporte-bot');

        expect(soporteBotConfig).toBeDefined();
        expect(soporteBotConfig!.name).toBe('Bot de Soporte');
        expect(soporteBotConfig!.phone).toBe('521234567890');
        expect(soporteBotConfig!.auto_responses).toHaveLength(1);
        expect(soporteBotConfig!.webhooks).toHaveLength(2);
      });

      it('should map soporte-bot from main-single.yml to domain entity', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main-single.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const soporteBotConfig = config.bots.find(b => b.id === 'soporte-bot')!;
        const bot = BotConfigMapper.toDomain(soporteBotConfig);

        expect(bot.id.value).toBe('soporte-bot');
        expect(bot.name).toBe('Bot de Soporte');
        expect(bot.phone?.value).toBe('521234567890');
        expect(bot.autoResponses).toHaveLength(1);
        expect(bot.webhooks).toHaveLength(2);
        expect(bot.settings.simulateTyping).toBe(true);
        expect(bot.settings.queueDelay).toBe(1000);
        expect(bot.settings.ignoreGroups).toBe(true);
        expect(bot.settings.adminNumbers).toContain('+521234567891');
      });

      it('should load ventas-bot correctly from main-single.yml', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main-single.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const ventasBotConfig = config.bots.find(b => b.id === 'ventas-bot');

        expect(ventasBotConfig).toBeDefined();
        expect(ventasBotConfig!.name).toBe('Bot de Ventas');
        expect(ventasBotConfig!.phone).toBeUndefined();
        expect(ventasBotConfig!.auto_responses).toHaveLength(1);
        expect(ventasBotConfig!.webhooks).toHaveLength(0);
      });

      it('should map ventas-bot from main-single.yml to domain entity', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main-single.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const ventasBotConfig = config.bots.find(b => b.id === 'ventas-bot')!;
        const bot = BotConfigMapper.toDomain(ventasBotConfig);

        expect(bot.id.value).toBe('ventas-bot');
        expect(bot.name).toBe('Bot de Ventas');
        expect(bot.phone).toBeUndefined();
        expect(bot.autoResponses).toHaveLength(1);
        expect(bot.webhooks).toHaveLength(0);
        expect(bot.settings.simulateTyping).toBe(false);
        expect(bot.settings.queueDelay).toBe(500);
        expect(bot.settings.ignoreGroups).toBe(false);
      });

      it('should validate auto-response pattern in soporte-bot', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main-single.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const soporteBotConfig = config.bots.find(b => b.id === 'soporte-bot')!;
        const bot = BotConfigMapper.toDomain(soporteBotConfig);

        const autoResponse = bot.autoResponses[0];
        expect(autoResponse.response).toBe('¡Hola! ¿En qué puedo ayudarte?');
        expect(autoResponse.priority).toBe(1);
        expect(autoResponse.matches('hola')).toBe(true);
        expect(autoResponse.matches('HOLA')).toBe(true); // case insensitive
        expect(autoResponse.matches('hi')).toBe(true);
        expect(autoResponse.matches('hello')).toBe(true);
      });

      it('should validate webhooks in soporte-bot', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main-single.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const soporteBotConfig = config.bots.find(b => b.id === 'soporte-bot')!;
        const bot = BotConfigMapper.toDomain(soporteBotConfig);

        const webhooks = bot.webhooks;
        expect(webhooks).toHaveLength(2);

        // First webhook
        expect(webhooks[0].name).toBe('procesar-pedido');
        expect(webhooks[0].url).toBe('http://localhost:5000/webhook');
        expect(webhooks[0].method).toBe('POST');
        expect(webhooks[0].timeout).toBe(5000);
        expect(webhooks[0].retries).toBe(3);
        expect(webhooks[0].priority).toBe(5);

        // Second webhook
        expect(webhooks[1].name).toBe('soporte-webhook');
        expect(webhooks[1].url).toBe('http://localhost:5000/support');
        expect(webhooks[1].method).toBe('POST');
        expect(webhooks[1].timeout).toBe(3000);
        expect(webhooks[1].retries).toBe(2);
        expect(webhooks[1].priority).toBe(10);
      });
    });

    describe('Configuration with Includes (main.yml)', () => {
      it('should load main.yml with includes successfully', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();

        expect(config).toBeDefined();
        expect(config.bots).toHaveLength(2);
      });

      it('should load soporte-bot from includes correctly', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const soporteBotConfig = config.bots.find(b => b.id === 'soporte-bot');

        expect(soporteBotConfig).toBeDefined();
        expect(soporteBotConfig!.name).toBe('Bot de Soporte');
        expect(soporteBotConfig!.phone).toBe('521234567890');
        // Note: includes version has more auto_responses
        expect(soporteBotConfig!.auto_responses!.length).toBeGreaterThanOrEqual(1);
        expect(soporteBotConfig!.webhooks).toHaveLength(2);
      });

      it('should map soporte-bot from includes to domain entity', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const soporteBotConfig = config.bots.find(b => b.id === 'soporte-bot')!;
        const bot = BotConfigMapper.toDomain(soporteBotConfig);

        expect(bot.id.value).toBe('soporte-bot');
        expect(bot.name).toBe('Bot de Soporte');
        expect(bot.phone?.value).toBe('521234567890');
        expect(bot.autoResponses.length).toBeGreaterThanOrEqual(1);
        expect(bot.webhooks).toHaveLength(2);
      });

      it('should load ventas-bot from includes correctly', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/main.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const ventasBotConfig = config.bots.find(b => b.id === 'ventas-bot');

        expect(ventasBotConfig).toBeDefined();
        expect(ventasBotConfig!.name).toBe('Bot de Ventas');
        expect(ventasBotConfig!.phone).toBeUndefined();
        expect(ventasBotConfig!.auto_responses).toHaveLength(1);
        expect(ventasBotConfig!.webhooks).toHaveLength(0);
      });

      it('should produce equivalent results between single file and includes', async () => {
        // Load from single file
        const singleFixturePath = path.join(__dirname, '../fixtures/main-single.yml');
        const singleRepository = new YamlConfigRepository(singleFixturePath);
        const singleConfig = await singleRepository.read();

        // Load from includes
        const includesFixturePath = path.join(__dirname, '../fixtures/main.yml');
        const includesRepository = new YamlConfigRepository(includesFixturePath);
        const includesConfig = await includesRepository.read();

        // Both should have 2 bots
        expect(singleConfig.bots).toHaveLength(2);
        expect(includesConfig.bots).toHaveLength(2);

        // Map both to domain entities
        const singleBots = singleConfig.bots.map(b => BotConfigMapper.toDomain(b));
        const includesBots = includesConfig.bots.map(b => BotConfigMapper.toDomain(b));

        // Sort by ID for comparison
        singleBots.sort((a, b) => a.id.value.localeCompare(b.id.value));
        includesBots.sort((a, b) => a.id.value.localeCompare(b.id.value));

        // Compare ventas-bot (should be identical)
        const singleVentas = singleBots.find(b => b.id.value === 'ventas-bot')!;
        const includesVentas = includesBots.find(b => b.id.value === 'ventas-bot')!;

        expect(singleVentas.id.value).toBe(includesVentas.id.value);
        expect(singleVentas.name).toBe(includesVentas.name);
        expect(singleVentas.autoResponses).toHaveLength(includesVentas.autoResponses.length);
        expect(singleVentas.webhooks).toHaveLength(includesVentas.webhooks.length);
      });
    });

  describe('Complete Configuration with Global Settings', () => {
    it('should load complete configuration from main-complete.yml', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/main-complete.yml');
      repository = new YamlConfigRepository(fixturePath);

      const config = await repository.read();

      // Verify global configuration
      expect(config.global).toBeDefined();
      expect(config.global?.chromiumPath).toBe('/usr/bin/chromium');
      expect(config.global?.apiPort).toBe(3000);
      expect(config.global?.apiEnabled).toBe(true);
      expect(config.global?.logLevel).toBe('info');

      // Verify bots array
      expect(config.bots).toHaveLength(2);
    });

    it('should load complete configuration from main-complete-includes.yml', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/main-complete-includes.yml');
      repository = new YamlConfigRepository(fixturePath);

      const config = await repository.read();

      // Verify global configuration
      expect(config.global).toBeDefined();
      expect(config.global?.chromiumPath).toBe('/usr/bin/chromium');
      expect(config.global?.apiPort).toBe(3000);
      expect(config.global?.apiEnabled).toBe(true);
      expect(config.global?.logLevel).toBe('info');

      // Verify bots array
      expect(config.bots).toHaveLength(2);
    });

    it('should produce identical results between main-complete.yml and main-complete-includes.yml', async () => {
      // Load from single file
      const singleFixturePath = path.join(__dirname, '../fixtures/main-complete.yml');
      const singleRepository = new YamlConfigRepository(singleFixturePath);
      const singleConfig = await singleRepository.read();

      // Load from includes
      const includesFixturePath = path.join(__dirname, '../fixtures/main-complete-includes.yml');
      const includesRepository = new YamlConfigRepository(includesFixturePath);
      const includesConfig = await includesRepository.read();

      // Compare global configuration
      expect(singleConfig.global?.chromiumPath).toBe(includesConfig.global?.chromiumPath);
      expect(singleConfig.global?.apiPort).toBe(includesConfig.global?.apiPort);
      expect(singleConfig.global?.apiEnabled).toBe(includesConfig.global?.apiEnabled);
      expect(singleConfig.global?.logLevel).toBe(includesConfig.global?.logLevel);

      // Both should have 2 bots
      expect(singleConfig.bots).toHaveLength(2);
      expect(includesConfig.bots).toHaveLength(2);

      // Map both to domain entities
      const singleBots = singleConfig.bots.map(b => BotConfigMapper.toDomain(b));
      const includesBots = includesConfig.bots.map(b => BotConfigMapper.toDomain(b));

      // Sort by ID for comparison
      singleBots.sort((a, b) => a.id.value.localeCompare(b.id.value));
      includesBots.sort((a, b) => a.id.value.localeCompare(b.id.value));

      // Compare each bot
      for (let i = 0; i < singleBots.length; i++) {
        const singleBot = singleBots[i];
        const includesBot = includesBots[i];

        expect(singleBot.id.value).toBe(includesBot.id.value);
        expect(singleBot.name).toBe(includesBot.name);
        expect(singleBot.phone?.value).toBe(includesBot.phone?.value);
        expect(singleBot.autoResponses).toHaveLength(includesBot.autoResponses.length);
        expect(singleBot.webhooks).toHaveLength(includesBot.webhooks.length);
        expect(singleBot.settings.queueDelay).toBe(includesBot.settings.queueDelay);
        expect(singleBot.settings.ignoreGroups).toBe(includesBot.settings.ignoreGroups);
        expect(singleBot.settings.ignoredSenders).toEqual(includesBot.settings.ignoredSenders);
      }
    });

    it('should map support-bot from complete configuration correctly', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/main-complete.yml');
      repository = new YamlConfigRepository(fixturePath);

      const config = await repository.read();
      const supportBotConfig = config.bots.find(b => b.id === 'support-bot-001')!;
      const bot = BotConfigMapper.toDomain(supportBotConfig);

      expect(bot.id.value).toBe('support-bot-001');
      expect(bot.name).toBe('Customer Support');
      expect(bot.phone?.value).toBe('1234567890');
      expect(bot.autoResponses.length).toBeGreaterThan(0);
      expect(bot.webhooks.length).toBeGreaterThan(0);
      expect(bot.settings.queueDelay).toBe(1500);
      expect(bot.settings.ignoreGroups).toBe(true);
      expect(bot.settings.ignoredSenders).toContain('status@broadcast');
      expect(bot.settings.ignoredSenders).toContain('1234567890');
    });

    it('should map sales-bot from complete configuration correctly', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/main-complete.yml');
      repository = new YamlConfigRepository(fixturePath);

      const config = await repository.read();
      const salesBotConfig = config.bots.find(b => b.id === 'sales-bot-002')!;
      const bot = BotConfigMapper.toDomain(salesBotConfig);

      expect(bot.id.value).toBe('sales-bot-002');
      expect(bot.name).toBe('Sales Assistant');
      expect(bot.phone?.value).toBe('1234567891');
      expect(bot.autoResponses.length).toBeGreaterThan(0);
      expect(bot.webhooks.length).toBeGreaterThan(0);
      expect(bot.settings.queueDelay).toBe(1000);
      expect(bot.settings.ignoreGroups).toBe(false);
      expect(bot.settings.ignoredSenders).toHaveLength(0);
    });
  });

  });

  describe('Invalid Configuration Files - Error Handling', () => {
    describe('Missing Required Fields', () => {
      it('should throw error when bot ID is missing', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/bot-missing-id.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const botConfig = config.bots[0];

        expect(() => BotConfigMapper.toDomain(botConfig)).toThrow();
      });

      it('should throw error when bot name is missing', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/bot-missing-name.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const botConfig = config.bots[0];

        expect(() => BotConfigMapper.toDomain(botConfig)).toThrow();
      });

      it('should throw error when bots array is missing', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/missing-bots.yml');
        repository = new YamlConfigRepository(fixturePath);

        await expect(repository.read()).rejects.toThrow(
          'Configuration must contain a "bots" array'
        );
      });
    });

    describe('Invalid Field Values', () => {
      it('should throw error when bot ID is too short', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/invalid-bot-id.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const botConfig = config.bots[0];

        expect(() => BotConfigMapper.toDomain(botConfig)).toThrow(
          'Bot ID must be at least 3 characters long'
        );
      });

      it('should throw error when phone number format is invalid', async () => {
        const fixturePath = path.join(__dirname, '../fixtures/invalid-phone.yml');
        repository = new YamlConfigRepository(fixturePath);

        const config = await repository.read();
        const botConfig = config.bots[0];

        expect(() => BotConfigMapper.toDomain(botConfig)).toThrow(
          'Invalid phone number format'
        );
      });
    });

    describe('Invalid Regex Patterns', () => {
      it('should throw error when auto-response pattern is invalid regex', async () => {
        const invalidConfig: ConfigFileDTO = {
          bots: [
            {
              id: 'test-bot',
              name: 'Test Bot',
              auto_responses: [
                {
                  pattern: '[invalid(regex',
                  response: 'Test response',
                  priority: 1
                }
              ]
            }
          ]
        };

        expect(() => BotConfigMapper.toDomain(invalidConfig.bots[0])).toThrow(
          'Invalid regex pattern'
        );
      });

      it('should throw error when webhook pattern is invalid regex', async () => {
        const invalidConfig: ConfigFileDTO = {
          bots: [
            {
              id: 'test-bot',
              name: 'Test Bot',
              webhooks: [
                {
                  name: 'test-webhook',
                  pattern: '[invalid(regex',
                  url: 'http://example.com',
                  method: 'POST'
                }
              ]
            }
          ]
        };

        expect(() => BotConfigMapper.toDomain(invalidConfig.bots[0])).toThrow(
          'Invalid regex pattern'
        );
      });
    });

    describe('Invalid Settings', () => {
      it('should throw error when typing delay is negative', async () => {
        const invalidConfig: ConfigFileDTO = {
          bots: [
            {
              id: 'test-bot',
              name: 'Test Bot',
              settings: {
                typing_delay: -100
              }
            }
          ]
        };

        expect(() => BotConfigMapper.toDomain(invalidConfig.bots[0])).toThrow(
          'Typing delay must be non-negative'
        );
      });

      it('should throw error when queue delay is negative', async () => {
        const invalidConfig: ConfigFileDTO = {
          bots: [
            {
              id: 'test-bot',
              name: 'Test Bot',
              settings: {
                queue_delay: -500
              }
            }
          ]
        };

        expect(() => BotConfigMapper.toDomain(invalidConfig.bots[0])).toThrow(
          'Queue delay must be non-negative'
        );
      });
    });

    describe('Invalid Auto-Response Configuration', () => {
      it('should throw error when auto-response is missing response text', async () => {
        const invalidConfig: ConfigFileDTO = {
          bots: [
            {
              id: 'test-bot',
              name: 'Test Bot',
              auto_responses: [
                {
                  pattern: 'hello',
                  response: '',
                  priority: 1
                }
              ]
            }
          ]
        };

        expect(() => BotConfigMapper.toDomain(invalidConfig.bots[0])).toThrow(
          'Response cannot be empty'
        );
      });

      it('should throw error when auto-response priority is negative', async () => {
        const invalidConfig: ConfigFileDTO = {
          bots: [
            {
              id: 'test-bot',
              name: 'Test Bot',
              auto_responses: [
                {
                  pattern: 'hello',
                  response: 'Hi there!',
                  priority: -1
                }
              ]
            }
          ]
        };

        expect(() => BotConfigMapper.toDomain(invalidConfig.bots[0])).toThrow(
          'Priority must be non-negative'
        );
      });
    });

    describe('Invalid Webhook Configuration', () => {
      it('should throw error when webhook name is empty', async () => {
        const invalidConfig: ConfigFileDTO = {
          bots: [
            {
              id: 'test-bot',
              name: 'Test Bot',
              webhooks: [
                {
                  name: '',
                  pattern: 'test',
                  url: 'http://example.com',
                  method: 'POST'
                }
              ]
            }
          ]
        };

        expect(() => BotConfigMapper.toDomain(invalidConfig.bots[0])).toThrow(
          'Webhook name cannot be empty'
        );
      });

      it('should throw error when webhook URL is empty', async () => {
        const invalidConfig: ConfigFileDTO = {
          bots: [
            {
              id: 'test-bot',
              name: 'Test Bot',
              webhooks: [
                {
                  name: 'test-webhook',
                  pattern: 'test',
                  url: '',
                  method: 'POST'
                }
              ]
            }
          ]
        };

        expect(() => BotConfigMapper.toDomain(invalidConfig.bots[0])).toThrow(
          'Webhook URL cannot be empty'
        );
      });

      it('should throw error when webhook priority is negative', async () => {
        const invalidConfig: ConfigFileDTO = {
          bots: [
            {
              id: 'test-bot',
              name: 'Test Bot',
              webhooks: [
                {
                  name: 'test-webhook',
                  pattern: 'test',
                  url: 'http://example.com',
                  method: 'POST',
                  priority: -5
                }
              ]
            }
          ]
        };

        expect(() => BotConfigMapper.toDomain(invalidConfig.bots[0])).toThrow(
          'Priority must be non-negative'
        );
      });
    });
  });

  describe('Configuration Variants', () => {
    it('should handle configuration with global settings', async () => {
      const config: ConfigFileDTO = {
        global: {
          chromiumPath: '/usr/bin/chromium',
          apiPort: 3000,
          apiEnabled: true,
          logLevel: 'info'
        },
        bots: [
          {
            id: 'test-bot',
            name: 'Test Bot'
          }
        ]
      };

      expect(config.global).toBeDefined();
      expect(config.global!.chromiumPath).toBe('/usr/bin/chromium');
      expect(config.global!.apiPort).toBe(3000);
      expect(config.global!.apiEnabled).toBe(true);
      expect(config.global!.logLevel).toBe('info');
    });

    it('should handle configuration with default settings when not provided', async () => {
      const config: ConfigFileDTO = {
        bots: [
          {
            id: 'test-bot',
            name: 'Test Bot'
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(config.bots[0]);

      // Should use defaults
      expect(bot.settings.simulateTyping).toBe(true);
      expect(bot.settings.typingDelay).toBe(1000);
      expect(bot.settings.queueDelay).toBe(1000);
      expect(bot.settings.readReceipts).toBe(true);
      expect(bot.settings.ignoreGroups).toBe(true);
    });

    it('should handle configuration with custom settings', async () => {
      const config: ConfigFileDTO = {
        bots: [
          {
            id: 'test-bot',
            name: 'Test Bot',
            settings: {
              simulate_typing: false,
              typing_delay: 500,
              queue_delay: 2000,
              read_receipts: false,
              ignore_groups: false,
              ignored_senders: ['1234567890', '0987654321'],
              admin_numbers: ['1111111111']
            }
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(config.bots[0]);

      expect(bot.settings.simulateTyping).toBe(false);
      expect(bot.settings.typingDelay).toBe(500);
      expect(bot.settings.queueDelay).toBe(2000);
      expect(bot.settings.readReceipts).toBe(false);
      expect(bot.settings.ignoreGroups).toBe(false);
      expect(bot.settings.ignoredSenders).toEqual(['1234567890', '0987654321']);
      expect(bot.settings.adminNumbers).toEqual(['1111111111']);
    });

    it('should handle configuration with multiple auto-responses', async () => {
      const config: ConfigFileDTO = {
        bots: [
          {
            id: 'test-bot',
            name: 'Test Bot',
            auto_responses: [
              {
                pattern: 'hello',
                response: 'Hi!',
                priority: 1
              },
              {
                pattern: 'bye',
                response: 'Goodbye!',
                priority: 2
              },
              {
                pattern: 'help',
                response: 'How can I help?',
                priority: 3,
                cooldown: 60
              }
            ]
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(config.bots[0]);

      expect(bot.autoResponses).toHaveLength(3);
      expect(bot.autoResponses[0].response).toBe('Hi!');
      expect(bot.autoResponses[1].response).toBe('Goodbye!');
      expect(bot.autoResponses[2].response).toBe('How can I help?');
      expect(bot.autoResponses[2].cooldown).toBe(60);
    });

    it('should handle configuration with multiple webhooks', async () => {
      const config: ConfigFileDTO = {
        bots: [
          {
            id: 'test-bot',
            name: 'Test Bot',
            webhooks: [
              {
                name: 'webhook-1',
                pattern: 'order',
                url: 'http://api.example.com/orders',
                method: 'POST',
                priority: 1
              },
              {
                name: 'webhook-2',
                pattern: 'support',
                url: 'http://api.example.com/support',
                method: 'POST',
                priority: 2,
                cooldown: 120
              }
            ]
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(config.bots[0]);

      expect(bot.webhooks).toHaveLength(2);
      expect(bot.webhooks[0].name).toBe('webhook-1');
      expect(bot.webhooks[1].name).toBe('webhook-2');
      expect(bot.webhooks[1].cooldown).toBe(120);
    });

    it('should handle configuration with response options', async () => {
      const config: ConfigFileDTO = {
        bots: [
          {
            id: 'test-bot',
            name: 'Test Bot',
            auto_responses: [
              {
                pattern: 'hello',
                response: 'Hi!',
                priority: 1,
                response_options: {
                  linkPreview: false,
                  sendAudioAsVoice: true,
                  isViewOnce: false
                }
              }
            ]
          }
        ]
      };

      const bot = BotConfigMapper.toDomain(config.bots[0]);

      expect(bot.autoResponses[0].responseOptions).toBeDefined();
      expect(bot.autoResponses[0].responseOptions!.linkPreview).toBe(false);
      expect(bot.autoResponses[0].responseOptions!.sendAudioAsVoice).toBe(true);
      expect(bot.autoResponses[0].responseOptions!.isViewOnce).toBe(false);
    });
  });
});
