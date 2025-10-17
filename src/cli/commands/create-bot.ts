import inquirer from 'inquirer';
import { createHash } from 'crypto';
import qrcode from 'qrcode-terminal';
import { BotConfigDTO } from '../../core/application/dtos/config-file.dto';
import { WhatsAppInitializer } from '../../core/infrastructure/whatsapp/whatsapp-initializer';
import { YamlConfigRepository } from '../../core/infrastructure/adapters/yaml-config.repository';

export async function createBotCommand() {
  console.log('🤖 Welcome to WWeb BotForge!');
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
    const botConfig: BotConfigDTO = {
      id: botId,
      name: botName,
      phone: phoneNumber,
      auto_responses: [],
      webhooks: [],
      settings: {
        queue_delay: 1000,
        ignore_groups: true,
        ignored_senders: ['status@broadcast'],
        log_level: 'info'
      }
    };

    // Save configuration to file using repository
    const configRepository = new YamlConfigRepository();
    await configRepository.addBotConfig(botConfig);
    
    console.log(`\n➕ Added new bot: ${botConfig.name} (${botConfig.id})`);
    console.log(`\n📁 Bot configuration saved to ${configRepository.getConfigPath()}`);
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
