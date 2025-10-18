#!/usr/bin/env node

import { Command } from 'commander';
import { createBotCommand } from './commands/create-bot';
import { BotFleetService } from '../core/application/services/bot-fleet.service';
import { MessageQueueService } from '../core/application/services/message-queue.service';
import { WhatsAppSessionManager } from '../core/infrastructure/adapters/whatsapp/whatsapp-session-manager';
import { WhatsAppConfig } from '../core/infrastructure/adapters/whatsapp/whatsapp-config';
import { YamlConfigRepository } from '../core/infrastructure/adapters/yaml-config.repository';
import { ApiServer } from '../core/infrastructure/api/server';
import { setGlobalLogger, getLogger } from '../core/infrastructure/utils/logger';
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

program
  .command('start')
  .description('Start the WhatsApp bots')
  .action(async () => {
    await startBots();
  });

async function startBots() {
  // Load bot configurations from YAML first to get log level
  const configRepository = new YamlConfigRepository();
  const configFile = await configRepository.read();

  // Configure global logger with log level from config
  if (configFile.global) {
    setGlobalLogger(configFile.global);
  }

  const logger = getLogger();
  logger.info('🤖 WWeb BotForge - Starting bots...');

  // Composition root - wire up dependencies
  const messageQueueService = new MessageQueueService();
  const channelManager = WhatsAppSessionManager.getInstance();
  const fleetLauncher = new BotFleetService(channelManager, messageQueueService);

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
}

program.parse();

