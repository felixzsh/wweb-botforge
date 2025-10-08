#!/usr/bin/env node

import { Command } from 'commander';
import { createBotCommand } from './commands/create-bot';
import { BotFleetService } from '../core/application/bot-fleet.service';
import { BotFactory } from '../core/application/bot-factory';
import { WhatsAppSessionManager } from '../core/infrastructure/whatsapp/whatsapp-session-manager';
import { WhatsAppConfig } from '../core/infrastructure/whatsapp/whatsapp-config';
import { YamlLoader } from '../core/infrastructure/yaml-loader';

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
  console.log('🤖 WWeb BotForge - Starting bots...\n');

  (async () => {
    // Composition root - wire up dependencies
    const botFactory = new BotFactory();
    const channelManager = WhatsAppSessionManager.getInstance();
    const fleetLauncher = new BotFleetService(botFactory, channelManager);

    // Load bot configurations from YAML
    const yamlLoader = new YamlLoader();
    const configFile = await yamlLoader.loadMainConfig();

    // Set global configuration for infrastructure
    if (configFile.global) {
      WhatsAppConfig.setGlobalConfig(configFile.global);
    }

    await fleetLauncher.start(configFile);
  })().catch((error) => {
    console.error('❌ Failed to start bots:', error);
    process.exit(1);
  });
} else {
  program.parse();
}

