import * as http from 'http'
import { loadConfig, setConfigPath } from '../config/yaml'

async function getApiBase(configPath?: string): Promise<string> {
  try {
    if (configPath) setConfigPath(configPath)
    const config = await loadConfig(configPath)
    const apiPort = config.api_port || 3000
    return `http://localhost:${apiPort}`
  } catch {
    return 'http://localhost:3000'
  }
}

async function apiGet(path: string, apiBase: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(path, apiBase)
    const options: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'GET',
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, data })
        }
      })
    })

    req.on('error', (err: any) => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error('Daemon is not running. Start it with: botforge daemon'))
      } else {
        reject(err)
      }
    })

    req.end()
  })
}

function stateToSymbol(state: string): string {
  switch (state) {
    case 'connected': return '\u{1F7E2}'
    case 'qr_received': return '\u{1F7E0}'
    case 'pending': return '\u{1F535}'
    case 'disconnected': return '\u{1F534}'
    case 'auth_failure': return '\u{1F534}'
    default: return '\u26AA'
  }
}

function stateLabel(state: string): string {
  switch (state) {
    case 'connected': return 'connected'
    case 'qr_received': return 'awaiting QR'
    case 'pending': return 'pending'
    case 'disconnected': return 'disconnected'
    case 'auth_failure': return 'auth failed'
    default: return 'unknown'
  }
}

export async function runStatus(configPath?: string): Promise<void> {
  try {
    if (configPath) setConfigPath(configPath)
    const apiBase = await getApiBase(configPath)

    const result: any = await apiGet('/api/status', apiBase)

    if (result.status !== 200) {
      console.error(`Error: ${result.data?.error || 'Unknown error'}`)
      process.exit(1)
    }

    const bots: any[] = result.data?.bots || []

    if (bots.length === 0) {
      console.log('No bots configured.')
      return
    }

    console.log('\nBot Status:')
    console.log('─'.repeat(60))

    for (const bot of bots) {
      const session = bot.session
      const state = session?.state || 'none'
      const symbol = stateToSymbol(state)
      const label = stateLabel(state)
      const phone = bot.phone || session?.phone || '-'
      const graph = bot.graph || '-'

      console.log(`  ${symbol} ${bot.id}`)
      console.log(`     State:  ${label}`)
      console.log(`     Phone:  ${phone}`)
      console.log(`     Graph:  ${graph}`)
      console.log('')
    }

    console.log(`Total: ${bots.length} bot(s) configured`)
    console.log('')

  } catch (error: any) {
    if (error.message?.includes('Daemon is not running')) {
      console.error(`\n${error.message}`)
    } else {
      console.error(`\nError: ${error.message || error}`)
    }
    process.exit(1)
  }
}
