#!/usr/bin/env node

import { Command } from 'commander'
import { execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { BotFleet } from './fleet'
import { OutboxService } from './messages/outbox'
import { ApiServer } from './api/server'
import { loadConfig, setConfigPath, getDefaultConfigPath } from './config/yaml'
import { setGlobalLogger, getLogger } from './helpers/logger'
import { setGlobalConfig } from './whatsapp/client'
import { runCreateBot } from './commands/create-bot'

const packageJsonPath = path.join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

const program = new Command()

program
  .name('botforge')
  .description('CLI tool for creating and managing WhatsApp bots')
  .version(packageJson.version)
  .option('-c, --config <path>', `Path to config file (default: ${getDefaultConfigPath()})`)

program
  .command('setup')
  .description('Setup/repair systemd service')
  .action(() => {
    const setupScript = path.join(__dirname, '..', 'scripts', 'setup-systemd.js')
    execSync(`node ${setupScript}`, { stdio: 'inherit' })
  })

program
  .command('create-bot')
  .description('Create a new WhatsApp bot interactively')
  .action(() => runCreateBot(program.opts().config))

program
  .command('start')
  .description('Start the WhatsApp bots')
  .action(async () => {
    await startBots(program.opts().config)
  })

async function startBots(configPath?: string) {
  if (configPath) setConfigPath(configPath)
  const configFile = await loadConfig(configPath)

  if (configFile.global) {
    setGlobalLogger(configFile.global)
    setGlobalConfig(configFile.global)
  }

  const logger = getLogger()
  logger.info('WWeb BotForge - Starting bots...')

  const outboxService = new OutboxService()
  const fleet = new BotFleet(outboxService)

  const bots = await fleet.start(configFile)

  if (configFile.global?.apiEnabled) {
    const apiPort = configFile.global.apiPort || 3000
    const apiServer = new ApiServer(outboxService, bots, apiPort)
    await apiServer.start()
  }
}

program.parse()
