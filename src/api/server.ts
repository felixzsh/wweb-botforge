import express, { Router } from 'express'
import { OutboxService } from '../messages/outbox'
import { Bot } from '../bot'
import { BotFleet } from '../fleet'
import { ConfigWatcher } from '../config/watcher'
import { createHealthRouter } from './routes/health'
import { createBotsRouter } from './routes/bots'
import { createMessagesRouter } from './routes/messages'
import { createSessionsRouter } from './routes/sessions'
import { createStatusRouter } from './routes/status'
import { createConfigRouter } from './routes/config'
import { getLogger } from '../helpers/logger'

export class ApiServer {
  private app: express.Application
  private port: number
  private apiKey?: string
  private outboxService: OutboxService
  private bots: Map<string, Bot>
  private fleet?: BotFleet
  private configWatcher?: ConfigWatcher
  private server: any

  constructor(
    outboxService: OutboxService,
    bots: Map<string, Bot>,
    port: number = 3000,
    fleet?: BotFleet,
    configWatcher?: ConfigWatcher,
    apiKey?: string
  ) {
    this.app = express()
    this.port = port
    this.apiKey = apiKey
    this.outboxService = outboxService
    this.bots = bots
    this.fleet = fleet
    this.configWatcher = configWatcher

    this.setupMiddleware()
    this.setupAuth()
    this.setupRoutes()
  }

  private get logger() {
    return getLogger()
  }

  private setupMiddleware(): void {
    this.app.use(express.json())

    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')

      if (req.method === 'OPTIONS') {
        res.sendStatus(200)
      } else {
        next()
      }
    })
  }

  private setupAuth(): void {
    if (!this.apiKey) return

    this.app.use('/api', (req, res, next) => {
      if (req.path === '/health') return next()

      const auth = req.headers.authorization
      if (auth !== `Bearer ${this.apiKey}`) {
        res.status(401).json({ error: 'Unauthorized — provide Authorization: Bearer <api_key>' })
        return
      }

      next()
    })
  }

  private setupRoutes(): void {
    const api = Router()
    api.use('/health', createHealthRouter())
    api.use('/bots', createBotsRouter(this.bots))
    api.use('/messages', createMessagesRouter(this.outboxService, this.bots))
    api.use('/sessions', createSessionsRouter())
    api.use('/status', createStatusRouter(this.bots))
    if (this.fleet && this.configWatcher) {
      api.use('/config', createConfigRouter(this.fleet, this.configWatcher))
    }
    this.app.use('/api', api)

    this.app.get('/', (req, res) => {
      const endpoints: any = {
        health: '/api/health',
        messages: '/api/messages',
        bots: '/api/bots',
        sessions: '/api/sessions',
        status: '/api/status',
      }
      if (this.fleet && this.configWatcher) {
        endpoints.config = '/api/config'
      }
      res.json({
        service: 'WWeb BotForge API',
        endpoints,
      })
    })

    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
      })
    })
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this.logger.info(`API Server started on port ${this.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('API Server stopped')
          resolve()
        })
      } else {
        this.logger.info('API Server stopped')
        resolve()
      }
    })
  }
}
