import inquirer from 'inquirer'
import qrcode from 'qrcode-terminal'
import { BotConfig } from '../config/schema'
import { WhatsAppInitializer } from '../whatsapp/client'
import { addBotConfig, getConfigPath, setConfigPath } from '../config/yaml'
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
    ])

    const botId = answers.botId.trim().toLowerCase()

    const initializer = new WhatsAppInitializer(botId)
    let phoneNumber: string | undefined

    initializer.onQRCode((qr: string) => {
      console.log('\nScan this QR code with WhatsApp to link your account:')
      qrcode.generate(qr, { small: true })
    })

    initializer.onAuthSuccess((phone: string) => {
      console.log('\nWhatsApp account linked successfully!')
      console.log(`Connected to WhatsApp with phone: ${phone}`)
      phoneNumber = phone
    })

    initializer.onAuthFailure((error: Error) => {
      console.error('\nAuthentication failed:', error.message)
      process.exit(1)
    })

    console.log('\nInitializing WhatsApp Web client...')
    await initializer.initialize()

    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (phoneNumber) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 1000)
    })

    const botConfig: BotConfig = {
      settings: {
        queue_delay: 1000,
        ignore_groups: true,
        ignored_senders: ['status@broadcast'],
      },
    }

    await addBotConfig(botId, botConfig, configPath)

    console.log(`\nAdded bot: ${botId}`)
    console.log(`Connected to WhatsApp with phone: ${phoneNumber}`)
    console.log(`\nBot configuration saved to ${getConfigPath()}`)
    console.log(`\nYour bot "${botId}" is now ready to use!`)

    await initializer.destroy()
    process.exit(0)

  } catch (error) {
    console.error('\nError creating bot:', error)
    process.exit(1)
  }
}


