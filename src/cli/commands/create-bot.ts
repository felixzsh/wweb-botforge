import inquirer from 'inquirer';
import { createHash } from 'crypto';
import { existsSync as existsPathSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join as joinPaths } from 'path';
import { load as loadYaml, dump as dumpYaml } from 'js-yaml';
import qrcode from 'qrcode-terminal';
import { BotConfiguration } from '../../core/domain/dtos/config.dto';
import { WhatsAppInitializer } from '../../core/infrastructure/whatsapp/whatsapp-initializer';

export async function createBotCommand() {
  console.log('🤖 Welcome to WhatsApp BotForge!');
  console.log('Let\'s create a new WhatsApp bot...\n');

  try {
    // Ask for bot name
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'botName',
        message: 'What would you like to name your bot?',
        validate: (input: string) => {
          if (input.trim().length === 0) {
            return 'Bot name cannot be empty';
          }
          return true;
        }
      }
    ]);

    const botName = answers.botName.trim();
    const botId = generateBotId(botName);
    
    console.log(`\n✅ Generated bot ID: ${botId}`);
    console.log(`📝 Bot name: ${botName}`);

    // Create WhatsApp initializer for authentication
    const initializer = new WhatsAppInitializer(botId);
    let phoneNumber: string | undefined;

    // Handle QR code generation
    initializer.onQRCode((qr: string) => {
      console.log('\n📱 Scan this QR code with WhatsApp to link your account:');
      qrcode.generate(qr, { small: true });
    });

    // Handle successful authentication
    initializer.onAuthSuccess((phone: string) => {
      console.log('\n✅ WhatsApp account linked successfully!');
      console.log(`📱 Connected to WhatsApp with phone: ${phone}`);
      phoneNumber = phone;
    });

    // Handle authentication failure
    initializer.onAuthFailure((error: Error) => {
      console.error('\n❌ Authentication failed:', error.message);
      process.exit(1);
    });

    console.log('\n🔗 Initializing WhatsApp Web client...');
    await initializer.initialize();

    // Wait for authentication to complete
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (phoneNumber) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });

    // Create bot configuration
    const botConfig: BotConfiguration = {
      id: botId,
      name: botName,
      phone: phoneNumber,
      auto_responses: [],
      webhooks: [],
      settings: {
        simulate_typing: true,
        typing_delay: 1000,
        read_receipts: true,
        ignore_groups: true,
        ignored_senders: ['status@broadcast'],
        admin_numbers: [],
        log_level: 'info'
      }
    };

    // Save configuration to file
    await saveBotConfig(botConfig);
    
    console.log(`\n📁 Bot configuration saved to config/main.yml`);
    console.log(`\n🎉 Your bot "${botName}" (${botId}) is now ready to use!`);
    console.log('\nTo start using your bot, run: npm start');
    
    // Clean up resources
    await initializer.destroy();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error creating bot:', error);
    process.exit(1);
  }
}

function generateBotId(name: string): string {
  // Create a simple hash-based ID from the name
  const hash = createHash('md5').update(name.toLowerCase()).digest('hex');
  // Take first 8 characters and add a prefix for readability
  return `bot-${hash.substring(0, 8)}`;
}

async function saveBotConfig(botConfig: BotConfiguration): Promise<void> {
  const configDir = joinPaths(process.cwd(), 'config');
  const configFile = joinPaths(configDir, 'main.yml');

  // Create config directory if it doesn't exist
  if (!existsPathSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  let existingConfig: { bots: BotConfiguration[] } = { bots: [] };

  // Read existing config if it exists
  if (existsPathSync(configFile)) {
    try {
      const content = readFileSync(configFile, 'utf8');
      existingConfig = loadYaml(content) as { bots: BotConfiguration[] };

      // Ensure bots array exists
      if (!existingConfig.bots) {
        existingConfig.bots = [];
      }
    } catch (error) {
      console.warn('⚠️  Could not parse existing config file, creating new one');
      existingConfig = { bots: [] };
    }
  }

  // Check if bot already exists
  const existingBotIndex = existingConfig.bots.findIndex(bot => bot.id === botConfig.id);
  if (existingBotIndex >= 0) {
    // Update existing bot
    existingConfig.bots[existingBotIndex] = botConfig;
    console.log(`\n📝 Updated existing bot: ${botConfig.name} (${botConfig.id})`);
  } else {
    // Add new bot
    existingConfig.bots.push(botConfig);
    console.log(`\n➕ Added new bot: ${botConfig.name} (${botConfig.id})`);
  }

  // Write updated config
  const yamlContent = dumpYaml(existingConfig, {
    indent: 2,
    lineWidth: -1,
    noRefs: true
  });
  writeFileSync(configFile, yamlContent, 'utf8');
}
