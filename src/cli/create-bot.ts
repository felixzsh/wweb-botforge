import inquirer from 'inquirer'
import { createHash } from 'crypto'
import qrcode from 'qrcode-terminal'
import { BotConfig } from '../bot/types'
import { WhatsAppInitializer } from '../whatsapp/client'
import { addBotConfig, getConfigPath, setConfigPath } from '../config/yaml'

export async function runCreateBot(configPath?: string) {
  if (configPath) setConfigPath(configPath)
  console.log('🤖 Welcome to WWeb BotForge!')
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

    console.log(`\n✅ Generated bot ID: ${botId}`)
    console.log(`📝 Bot name: ${botName}`)

    const initializer = new WhatsAppInitializer(botId)
    let phoneNumber: string | undefined

    initializer.onQRCode((qr: string) => {
      console.log('\n📱 Scan this QR code with WhatsApp to link your account:')
      qrcode.generate(qr, { small: true })
    })

    initializer.onAuthSuccess((phone: string) => {
      console.log('\n✅ WhatsApp account linked successfully!')
      console.log(`📱 Connected to WhatsApp with phone: ${phone}`)
      phoneNumber = phone
    })

    initializer.onAuthFailure((error: Error) => {
      console.error('\n❌ Authentication failed:', error.message)
      process.exit(1)
    })

    console.log('\n🔗 Initializing WhatsApp Web client...')
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
      id: botId,
      name: botName,
      phone: phoneNumber,
      settings: {
        queue_delay: 1000,
        ignore_groups: true,
        ignored_senders: ['status@broadcast'],
      },
    }

    await addBotConfig(botConfig, configPath)

    console.log(`\n➕ Added new bot: ${botConfig.name} (${botConfig.id})`)
    console.log(`\n📁 Bot configuration saved to ${getConfigPath()}`)
    console.log(`\n🎉 Your bot "${botName}" (${botId}) is now ready to use!`)
    console.log('\nTo start using your bot, run: npm start')

    await initializer.destroy()
    process.exit(0)

  } catch (error) {
    console.error('\n❌ Error creating bot:', error)
    process.exit(1)
  }
}

function generateBotId(name: string): string {
  const hash = createHash('md5').update(name.toLowerCase()).digest('hex')
  return `bot-${hash.substring(0, 8)}`
}
