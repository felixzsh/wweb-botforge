import inquirer from 'inquirer'
import { BotConfig } from '../config/schema'
import { addBotConfig, setConfigPath, getConfigPath } from '../config/yaml'
import { validateId } from '../helpers/validation'

export async function runCreateBot(configPath?: string) {
  if (configPath) setConfigPath(configPath)
  console.log('Welcome to WWeb BotForge!')
  console.log('Let\'s create a new WhatsApp bot...\n')

  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'botId',
        message: 'Enter bot name identifier:',
        validate: (input: string) => {
          const sanitized = input.trim().toLowerCase()
          if (sanitized.length === 0) {
            return 'Bot name cannot be empty'
          }
          try {
            validateId(sanitized, 'Bot')
          } catch (e) {
            return (e as Error).message
          }
          return true
        },
      },
      {
        type: 'confirm',
        name: 'authenticateNow',
        message: 'Do you want to authenticate now? (daemon must be running)',
        default: false,
      },
    ])

    const botId = answers.botId.trim().toLowerCase()

    const botConfig: BotConfig = {
      settings: {
        queue_delay: 1000,
        ignore_groups: true,
        ignored_senders: ['status@broadcast'],
      },
    }

    await addBotConfig(botId, botConfig, configPath)

    console.log(`\nAdded bot: ${botId}`)
    console.log(`Bot configuration saved.`)

    if (answers.authenticateNow) {
      console.log(`\nTo authenticate, run: botforge auth ${botId}`)
      console.log('(Make sure the daemon is running first)')
    }

    console.log(`\nEdit ${getConfigPath()} to add flows and actions.`)
    console.log('Then run: botforge daemon')

  } catch (error) {
    console.error('\nError creating bot:', error)
    process.exit(1)
  }
}
