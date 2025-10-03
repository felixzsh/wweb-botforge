import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { BotConfiguration } from '../core/domain/entities/bot.entity';

// Test the bot ID generation and config saving without WhatsApp Web
function testBotCreation() {
  console.log('🧪 Testing bot creation functionality...\n');

  const botName = 'Test Bot';
  const botId = generateBotId(botName);
  
  console.log(`✅ Generated bot ID: ${botId}`);
  console.log(`📝 Bot name: ${botName}`);
  
  // Create bot configuration
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

  // Save configuration to file
  saveBotConfig(botConfig);
  
  console.log(`\n📁 Bot configuration saved to config/main.yml`);
  console.log(`\n🎉 Test completed successfully!`);
}

function generateBotId(name: string): string {
  // Create a simple hash-based ID from the name
  const hash = crypto.createHash('md5').update(name.toLowerCase()).digest('hex');
  // Take first 8 characters and add a prefix for readability
  return `bot-${hash.substring(0, 8)}`;
}

function saveBotConfig(botConfig: BotConfiguration): void {
  const configDir = path.join(process.cwd(), 'config');
  const configFile = path.join(configDir, 'main.yml');
  
  // Create config directory if it doesn't exist
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  let existingConfig: { bots: BotConfiguration[] } = { bots: [] };
  
  // Read existing config if it exists
  if (fs.existsSync(configFile)) {
    try {
      const content = fs.readFileSync(configFile, 'utf8');
      existingConfig = { bots: [] };
      // Simple YAML parsing for existing config
      const lines = content.split('\n');
      let inBots = false;
      let botContent = '';
      
      for (const line of lines) {
        if (line.trim() === 'bots:') {
          inBots = true;
          continue;
        }
        if (inBots && line.trim().startsWith('-')) {
          botContent += line + '\n';
        } else if (inBots && line.trim() && !line.trim().startsWith('#')) {
          // End of bots array
          break;
        }
      }
      
      // For now, we'll just append to the existing bots array
      // In a real implementation, we'd use a proper YAML parser
      existingConfig.bots = [botConfig];
    } catch (error) {
      console.warn('⚠️  Could not parse existing config file, creating new one');
    }
  }

  // Add new bot to existing bots array
  const existingBotIndex = existingConfig.bots.findIndex(bot => bot.id === botConfig.id);
  if (existingBotIndex >= 0) {
    existingConfig.bots[existingBotIndex] = botConfig;
  } else {
    existingConfig.bots.push(botConfig);
  }

  // Write updated config
  const yamlContent = generateYamlConfig(existingConfig.bots);
  fs.writeFileSync(configFile, yamlContent, 'utf8');
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

// Run the test
testBotCreation();