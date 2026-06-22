import inquirer from 'inquirer'
import { createHash } from 'crypto'
import qrcode from 'qrcode-terminal'
import { BotConfig } from '../bot/types'
import { WhatsAppInitializer } from '../whatsapp/client'
import { addBotConfig, getConfigPath, setConfigPath } from '../config/yaml'

export async function runCreateBot(configPath?: string) {
  if (configPath) setConfigPath(configPath)
  console.log('Welcome to WWeb BotForge!')
  console.log('Let\'s create a new WhatsApp bot...\n')

  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'botName',
        message: 'What would you like to name your bot?',
        validate: (input: string) => {
          if (input.trim().length === 0) {
            return 'Bot name cannot be empty'
          }
          return true
        },
      },
    ])

    const botName = answers.botName.trim()
    const botId = generateBotId(botName)

    console.log(`\nGenerated bot ID: ${botId}`)
    console.log(`Bot name: ${botName}`)

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

    console.log(`\nAdded new bot: ${botName} (${botId})`)
    console.log(`Connected to WhatsApp with phone: ${phoneNumber}`)
    console.log(`\nBot configuration saved to ${getConfigPath()}`)
    console.log(`\nYour bot "${botName}" (${botId}) is now ready to use!`)
    console.log('\nTo start using your bot, run: npm start')

    await initializer.destroy()
    process.exit(0)

  } catch (error) {
    console.error('\nError creating bot:', error)
    process.exit(1)
  }
}

function generateBotId(name: string): string {
  const hash = createHash('md5').update(name.toLowerCase()).digest('hex')
  return `bot-${hash.substring(0, 8)}`
}
