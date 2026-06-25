import * as http from 'http'
import qrcode from 'qrcode-terminal'
import { loadConfig, setConfigPath } from '../config/yaml'

async function getApiBase(configPath?: string): Promise<string> {
  try {
    if (configPath) setConfigPath(configPath)
    const config = await loadConfig(configPath)
    const apiPort = config.apiPort || 3000
    return `http://localhost:${apiPort}`
  } catch {
    return 'http://localhost:3000'
  }
}

async function apiRequest(method: string, path: string, apiBase: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(path, apiBase)
    const options: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
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

    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

function subscribeToSSE(urlStr: string, onEvent: (type: string, data: any) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr)
    const options: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
    }

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => reject(new Error(`SSE error ${res.statusCode}: ${data}`)))
        return
      }

      let buffer = ''

      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const lines = part.split('\n')
          let eventType = 'message'
          let data = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim()
            else if (line.startsWith('data: ')) data = line.slice(6)
          }

          if (data) {
            try {
              onEvent(eventType, JSON.parse(data))
            } catch {
              onEvent(eventType, data)
            }
          }
        }
      })

      res.on('end', resolve)
      res.on('error', reject)
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

export async function runAuth(botId: string, configPath?: string): Promise<void> {
  try {
    if (configPath) setConfigPath(configPath)

    const apiBase = await getApiBase(configPath)

    console.log(`\nAuthenticating bot: ${botId}`)
    console.log('Contacting daemon...\n')

    const result: any = await apiRequest('POST', `/api/sessions/${botId}`, apiBase)

    if (result.status === 409) {
      console.log(`Bot "${botId}" is already authenticated.`)
      return
    }

    if (result.status !== 200) {
      console.error(`Error: ${result.data?.error || 'Unknown error'}`)
      process.exit(1)
    }

    const state = result.data?.session?.state

    if (state === 'connected') {
      console.log(`Bot "${botId}" is already connected!`)
      return
    }

    console.log('Waiting for QR code...')
    console.log('(The QR code refreshes every 30 seconds if not scanned)\n')

    let hasShownQR = false

    await subscribeToSSE(`${apiBase}/api/sessions/${botId}/events`, (eventType: string, data: any) => {
      switch (eventType) {
        case 'qr':
          if (!hasShownQR) {
            console.log('Scan this QR code with WhatsApp to link your account:\n')
            hasShownQR = true
          }
          qrcode.generate(data, { small: true })
          break

        case 'ready':
          console.log('\nBot authenticated successfully!')
          process.exit(0)

        case 'auth_failure':
          console.error(`\nAuthentication failed: ${data}`)
          process.exit(1)

        case 'disconnected':
          console.log(`\nSession disconnected: ${data}`)
          break
      }
    })

  } catch (error: any) {
    if (error.message?.includes('Daemon is not running')) {
      console.error(`\n${error.message}`)
    } else {
      console.error(`\nError: ${error.message || error}`)
    }
    process.exit(1)
  }
}
