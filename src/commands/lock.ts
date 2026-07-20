import * as path from 'path'
import * as fs from 'fs'
import { AuthService } from '../auth/service'
import { loadConfig, setConfigPath } from '../config/yaml'
import { getDataDir } from '../helpers/data'

export async function runLock(key?: string, configPath?: string): Promise<void> {
  try {
    if (configPath) setConfigPath(configPath)
    await loadConfig(configPath)

    const dataDir = getDataDir()
    fs.mkdirSync(dataDir, { recursive: true })
    const dbPath = path.join(dataDir, 'botforje-js.db')
    const auth = new AuthService(dbPath)

    if (auth.isLocked()) {
      console.error('Botforje-js is already locked. Run `botforje-js unlock` first to reset the key.')
      process.exit(1)
    }

    if (key && key.length < 32) {
      console.error('Key must be at least 32 characters long.')
      process.exit(1)
    }

    const secret = auth.lock(key)

    console.log('\n' + '='.repeat(60))
    console.log('BOTFORJE-JS AUTH KEY')
    console.log('='.repeat(60))
    console.log(`\n${secret}\n`)
    console.log('-'.repeat(60))
    console.log('IMPORTANT: Save this key somewhere safe. It CANNOT be recovered.')
    console.log('='.repeat(60) + '\n')

    process.exit(0)
  } catch (error: any) {
    console.error(`\nError: ${error.message || error}`)
    process.exit(1)
  }
}
