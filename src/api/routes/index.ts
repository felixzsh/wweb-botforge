import { Router } from 'express'
import { OutboxService } from '../../services/outbox'
import { Bot } from '../../bot/types'
import { createHealthRouter } from './health'
import { createMessagesRouter } from './messages'
import { createBotsRouter } from './bots'

export function createApiRoutes(
  outboxService: OutboxService,
  bots: Map<string, Bot>
): Router {
  const router = Router()

  router.use('/health', createHealthRouter())
  router.use('/messages', createMessagesRouter(outboxService, bots))
  router.use('/bots', createBotsRouter(bots))

  return router
}
