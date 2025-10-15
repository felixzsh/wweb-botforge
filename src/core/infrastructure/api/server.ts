import express from 'express';
import { MessageQueueService } from '../../application/message-queue.service';
import { Bot } from '../../domain/entities/bot.entity';
import { createApiRoutes } from './routes';
import { getLogger } from '../logger';

export class ApiServer {
  private app: express.Application;
  private port: number;
  private messageQueueService: MessageQueueService;
  private bots: Map<string, Bot>;

  constructor(messageQueueService: MessageQueueService, bots: Map<string, Bot>, port: number = 3000) {
    this.app = express();
    this.port = port;
    this.messageQueueService = messageQueueService;
    this.bots = bots;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private get logger() {
    return getLogger();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // CORS middleware for future API clients
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes(): void {
    // API routes under /api prefix
    this.app.use('/api', createApiRoutes(this.messageQueueService, this.bots));

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'WWeb BotForge API',
        version: '1.0.0',
        endpoints: {
          health: '/api/health',
          messages: '/api/messages',
          bots: '/api/bots',
          docs: 'See README.md for API documentation'
        }
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        availableEndpoints: {
          health: 'GET /api/health',
          sendMessage: 'POST /api/messages/send',
          queueStatus: 'GET /api/messages/queue/:botId',
          allQueues: 'GET /api/messages/queue',
          listBots: 'GET /api/bots',
          getBot: 'GET /api/bots/:botId'
        }
      });
    });
  }

  private server: any;

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        this.logger.info(`🚀 API Server started on port ${this.port}`);
        this.logger.info(`📖 API Documentation: http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('🛑 API Server stopped');
          resolve();
        });
      } else {
        this.logger.info('🛑 API Server stopped');
        resolve();
      }
    });
  }
}