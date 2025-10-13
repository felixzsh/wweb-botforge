#!/usr/bin/env node

import { Command } from 'commander';
import { createBotCommand } from './commands/create-bot';
import { BotFleetService } from '../core/application/bot-fleet.service';
import { BotFactory } from '../core/application/bot-factory';
import { MessageQueueService } from '../core/application/message-queue.service';
import { WhatsAppSessionManager } from '../core/infrastructure/whatsapp/whatsapp-session-manager';
import { WhatsAppConfig } from '../core/infrastructure/whatsapp/whatsapp-config';
import { YamlLoader } from '../core/infrastructure/yaml-loader';
import { ApiServer } from '../core/infrastructure/api/server';
import { execSync } from 'child_process';
import * as path from 'path';

const program = new Command();

program
  .name('botforge')
  .description('CLI tool for creating and managing WhatsApp bots')
  .version('1.0.0');

program
  .command('setup')
  .description('Setup/repair systemd service')
  .action(() => {
    const setupScript = path.join(__dirname, '..', '..', 'scripts', 'setup-systemd.js');
    execSync(`node ${setupScript}`, { stdio: 'inherit' });
  });

program
  .command('create-bot')
  .description('Create a new WhatsApp bot interactively')
  .action(createBotCommand);

// If no command is provided, start the bots automatically
if (process.argv.length === 2) {
  console.log('🤖 WWeb BotForge - Starting bots...\n');

  (async () => {
    // Composition root - wire up dependencies
    const messageQueueService = new MessageQueueService();
    const botFactory = new BotFactory();
    const channelManager = WhatsAppSessionManager.getInstance();
    const fleetLauncher = new BotFleetService(botFactory, channelManager, messageQueueService);

    // Load bot configurations from YAML
    const yamlLoader = new YamlLoader();
    const configFile = await yamlLoader.loadMainConfig();

    // Set global configuration for infrastructure
    if (configFile.global) {
      WhatsAppConfig.setGlobalConfig(configFile.global);
    }

    // Start bots and get the bot instances
    const bots = await fleetLauncher.start(configFile);

    // Start API server if enabled
    if (configFile.global?.apiEnabled) {
      const apiPort = configFile.global.apiPort || 3000;
      const apiServer = new ApiServer(messageQueueService, bots, apiPort);
      await apiServer.start();
    }
  })().catch((error) => {
    console.error('❌ Failed to start bots:', error);
    process.exit(1);
  });
} else {
  program.parse();
}

