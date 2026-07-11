import * as readline from 'readline'
import * as path from 'path'
import * as fs from 'fs'
import { AuthService } from '../auth/service'
import { loadConfig, setConfigPath } from '../config/yaml'
import { getDataDir } from '../helpers/data'

function promptHidden(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

export async function runUnlock(key?: string, configPath?: string): Promise<void> {
  try {
    if (configPath) setConfigPath(configPath)
    await loadConfig(configPath)

    const dataDir = getDataDir()
    fs.mkdirSync(dataDir, { recursive: true })
    const dbPath = path.join(dataDir, 'botforje.db')
    const auth = new AuthService(dbPath)

    if (!auth.isLocked()) {
      console.log('Botforje is not locked. Nothing to do.')
      process.exit(0)
    }

    const providedKey = key || await promptHidden('Enter current auth key: ')

    if (!providedKey) {
      console.error('Key is required.')
      process.exit(1)
    }

    const success = auth.unlock(providedKey)

    if (success) {
      console.log('\nBotforje unlocked successfully. Auth is no longer required.')
      console.log('All active sessions have been invalidated.\n')
      process.exit(0)
    } else {
      console.error('\nInvalid key. Unlock failed.\n')
      process.exit(1)
    }
  } catch (error: any) {
    console.error(`\nError: ${error.message || error}`)
    process.exit(1)
  }
}
