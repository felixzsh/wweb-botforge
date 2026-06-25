#!/usr/bin/env node

import { Command } from 'commander'
import { execSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { BotFleet } from './fleet'
import { OutboxService } from './messages/outbox'
import { ApiServer } from './api/server'
import { loadConfig, setConfigPath, getDefaultConfigPath } from './config/yaml'
import { ConfigWatcher } from './config/watcher'
import { setGlobalLogger, getLogger } from './helpers/logger'
import { setGlobalConfig } from './whatsapp/client'
import { runGuide } from './commands/guide'
import { runValidate } from './commands/validate'
import { runAuth } from './commands/auth'
import { runStatus } from './commands/status'

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
  .command('guide')
  .description('Show AI agent configuration guide')
  .action(() => runGuide())

program
  .command('validate')
  .description('Validate bot configuration')
  .action(() => runValidate(program.opts().config))

program
  .command('daemon')
  .alias('start')
  .description('Start the WhatsApp bot daemon')
  .action(async () => {
    await runDaemon(program.opts().config)
  })

program
  .command('auth')
  .description('Authenticate a bot session via QR code')
  .argument('<botId>', 'Bot ID to authenticate')
  .action(async (botId) => {
    await runAuth(botId, program.opts().config)
  })

program
  .command('status')
  .description('Show all bots and their session status')
  .action(async () => {
    await runStatus(program.opts().config)
  })

async function runDaemon(configPath?: string) {
  if (configPath) setConfigPath(configPath)
  const configFile = await loadConfig(configPath)

  if (configFile) {
    setGlobalLogger(configFile)
    setGlobalConfig(configFile)
  }

  const logger = getLogger()
  logger.info('WWeb BotForge - Starting bots...')

  const outboxService = new OutboxService()
  const fleet = new BotFleet(outboxService)

  const configWatcher = new ConfigWatcher(fleet)
  configWatcher.start()

  const bots = await fleet.start(configFile)

  if (configFile?.apiEnabled) {
    const apiPort = configFile.apiPort || 3000
    const apiServer = new ApiServer(outboxService, bots, apiPort, fleet, configWatcher)
    await apiServer.start()
  }

  logger.info('WWeb BotForge Daemon is running')
}

program.parse()
