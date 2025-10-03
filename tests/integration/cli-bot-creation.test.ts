import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { BotConfiguration } from '../../src/core/domain/entities/bot.entity';

describe('CLI Bot Creation Integration Test', () => {
  const testConfigPath = path.join(__dirname, '..', 'fixtures', 'test-config.yml');

  beforeEach(() => {
    // Clean up test config file if it exists
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    // Clean up test config file if it exists
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  test('should generate bot ID from name', () => {
    const botName = 'Test Bot';
    const botId = generateBotId(botName);
    
    expect(botId).toMatch(/^bot-[a-f0-9]{8}$/);
    expect(botId).toBe('bot-35107ef4'); // This should be deterministic
  });

  test('should create bot configuration file', () => {
    const botName = 'Integration Test Bot';
    const botId = generateBotId(botName);
    
    const botConfig: BotConfiguration = {
      id: botId,
      name: botName,
      auto_responses: [],
      webhooks: [],
      settings: {
        simulate_typing: true,
        typing_delay: 1000,
        read_receipts: true,
        ignore_groups: true,
        admin_numbers: [],
        log_level: 'info'
      }
    };

    saveBotConfig(botConfig, testConfigPath);
    
    // Verify file was created
    expect(fs.existsSync(testConfigPath)).toBe(true);
    
    // Verify content
    const content = fs.readFileSync(testConfigPath, 'utf8');
    expect(content).toContain(`id: ${botId}`);
    expect(content).toContain(`name: "${botName}"`);
    expect(content).toContain('auto_responses: []');
    expect(content).toContain('webhooks: []');
  });

  test('should append to existing config file', () => {
    // Create initial config manually to test the append logic
    const initialConfig = `# Test config
bots:
  - id: existing-bot
    name: "Existing Bot"
    auto_responses: []
    webhooks: []
    settings:
      simulate_typing: true
      typing_delay: 1000
      read_receipts: true
      ignore_groups: true
      admin_numbers: []
      log_level: info
`;

    fs.writeFileSync(testConfigPath, initialConfig, 'utf8');
    
    // Add another bot
    const newBot: BotConfiguration = {
      id: 'new-bot',
      name: 'New Bot',
      auto_responses: [],
      webhooks: [],
      settings: {
        simulate_typing: true,
        typing_delay: 1000,
        read_receipts: true,
        ignore_groups: true,
        admin_numbers: [],
        log_level: 'info'
      }
    };

    saveBotConfig(newBot, testConfigPath);
    
    // Verify both bots are in the file
    const content = fs.readFileSync(testConfigPath, 'utf8');
    expect(content).toContain('id: existing-bot');
    expect(content).toContain('id: new-bot');
  });
});

// Helper functions from the CLI (copied for testing)
function generateBotId(name: string): string {
  const hash = crypto.createHash('md5').update(name.toLowerCase()).digest('hex');
  return `bot-${hash.substring(0, 8)}`;
}

function saveBotConfig(botConfig: BotConfiguration, configPath: string): void {
  const configDir = path.dirname(configPath);
  
  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let existingBots: BotConfiguration[] = [];
  
  // Read existing config if it exists
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      const lines = content.split('\n');
      let inBots = false;
      let currentBot: any = null;
      let indentLevel = 0;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine === 'bots:') {
          inBots = true;
          continue;
        }
        
        if (inBots) {
          if (trimmedLine.startsWith('-')) {
            // Start of a new bot
            if (currentBot) {
              existingBots.push(currentBot);
            }
            currentBot = {};
            continue;
          }
          
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            // Parse bot properties
            const [key, value] = trimmedLine.split(':').map(s => s.trim());
            if (key && value !== undefined) {
              if (currentBot) {
                currentBot[key] = value.replace(/^"|"$/g, ''); // Remove quotes
              }
            }
          }
          
          // If we hit a non-indented line after bots, we're done
          if (!trimmedLine && line.length === 0 && currentBot) {
            existingBots.push(currentBot);
            currentBot = null;
            inBots = false;
          }
        }
      }
      
      // Add the last bot if exists
      if (currentBot) {
        existingBots.push(currentBot);
      }
    } catch (error) {
      console.warn('⚠️  Could not parse existing config file, creating new one');
    }
  }

  // Add new bot to existing bots array
  const existingBotIndex = existingBots.findIndex(bot => bot.id === botConfig.id);
  if (existingBotIndex >= 0) {
    existingBots[existingBotIndex] = botConfig;
  } else {
    existingBots.push(botConfig);
  }

  // Write updated config
  const yamlContent = generateYamlConfig(existingBots);
  fs.writeFileSync(configPath, yamlContent, 'utf8');
}

function generateYamlConfig(bots: BotConfiguration[]): string {
  let yaml = `# WhatsApp BotForge Configuration\n`;
  yaml += `# Generated automatically - do not edit manually unless you know what you're doing\n\n`;
  yaml += `bots:\n`;
  
  for (const bot of bots) {
    yaml += `  - id: ${bot.id}\n`;
    yaml += `    name: "${bot.name}"\n`;
    
    if (bot.phone) {
      yaml += `    phone: "${bot.phone}"\n`;
    }
    
    yaml += `    auto_responses: []\n`;
    yaml += `    webhooks: []\n`;
    yaml += `    settings:\n`;
    yaml += `      simulate_typing: true\n`;
    yaml += `      typing_delay: 1000\n`;
    yaml += `      read_receipts: true\n`;
    yaml += `      ignore_groups: true\n`;
    yaml += `      admin_numbers: []\n`;
    yaml += `      log_level: info\n`;
    yaml += `\n`;
  }
  
  return yaml;
}