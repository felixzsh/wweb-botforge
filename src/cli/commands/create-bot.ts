import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';
import qrcode from 'qrcode-terminal';
import { BotConfiguration } from '../../core/domain/entities/bot.entity';
import { WhatsAppFactory } from '../../core/infrastructure/whatsapp';

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
    
    // Generate bot ID from name
    const botId = generateBotId(botName);
    
    console.log(`\n✅ Generated bot ID: ${botId}`);
    console.log(`📝 Bot name: ${botName}`);

    // Create WhatsApp client using the abstraction layer
    const client = WhatsAppFactory.createClient(botId);

    console.log('\n🔗 Initializing WhatsApp Web client...');

    // Generate and display QR code
    client.onQRCode((qr: string) => {
      console.log('\n📱 Scan this QR code with WhatsApp to link your account:');
      qrcode.generate(qr, { small: true });
    });

    // Handle authentication
    client.onReady(() => {
      console.log('\n✅ WhatsApp account linked successfully!');
    });

    // Handle ready event
    client.onReady(async () => {
      console.log('\n✅ WhatsApp client is ready!');

      // Get the phone number from the authenticated session
      const session = client.getSession();
      if (session.phoneNumber) {
        console.log(`📱 Connected to WhatsApp with phone: ${session.phoneNumber}`);
      }

      // Create bot configuration
      const botConfig: BotConfiguration = {
        id: botId,
        name: botName,
        phone: session.phoneNumber,
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
      await saveBotConfig(botConfig);
      
      console.log(`\n📁 Bot configuration saved to config/main.yml`);
      console.log(`\n🎉 Your bot "${botName}" (${botId}) is now ready to use!`);
      console.log('\nTo start using your bot, run: npm start');
      
      // Gracefully close the client
      await client.destroy();
      process.exit(0);
    });

    // Handle authentication failure
    client.onAuthFailure((error: Error) => {
      console.error('\n❌ Authentication failed:', error.message);
      process.exit(1);
    });

    // Handle disconnection
    client.onDisconnected((reason: string) => {
      console.log('\n⚠️  WhatsApp client disconnected:', reason);
      process.exit(1);
    });

    // Initialize the client
    await client.initialize();

  } catch (error) {
    console.error('\n❌ Error creating bot:', error);
    process.exit(1);
  }
}

function generateBotId(name: string): string {
  // Create a simple hash-based ID from the name
  const hash = crypto.createHash('md5').update(name.toLowerCase()).digest('hex');
  // Take first 8 characters and add a prefix for readability
  return `bot-${hash.substring(0, 8)}`;
}

async function saveBotConfig(botConfig: BotConfiguration): Promise<void> {
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
      existingConfig = yaml.load(content) as { bots: BotConfiguration[] };

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
  const yamlContent = yaml.dump(existingConfig, {
    indent: 2,
    lineWidth: -1,
    noRefs: true
  });
  fs.writeFileSync(configFile, yamlContent, 'utf8');
}
