#!/usr/bin/env node

import { Command } from 'commander';
import { createBotCommand } from './commands/create-bot';
import { BotFleetLauncher } from '../core/application/bot-fleet-launcher.service';
import { BotFactory } from '../core/infrastructure/bot-factory';
import { WhatsAppFactory } from '../core/infrastructure/whatsapp';
import { IChatFactory } from '../core/domain/interfaces/i-chat-factory.interface';

const program = new Command();

program
  .name('botforge')
  .description('CLI tool for creating and managing WhatsApp bots')
  .version('1.0.0');

program
  .command('create-bot')
  .description('Create a new WhatsApp bot interactively')
  .action(createBotCommand);

// If no command is provided, start the bots automatically
if (process.argv.length === 2) {
  console.log('🤖 WhatsApp BotForge - Starting bots...\n');

  const botFactory = new BotFactory();
  const whatsappFactory = WhatsAppFactory.getInstance();
  const fleetLauncher = new BotFleetLauncher(botFactory, whatsappFactory);

  fleetLauncher.start().catch((error) => {
    console.error('❌ Failed to start bots:', error);
    process.exit(1);
  });
} else {
  program.parse();
}
