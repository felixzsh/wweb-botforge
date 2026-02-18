import { Router } from 'express'
import { MessageQueueService } from '../../services/message-queue'
import { Bot } from '../../bot/types'
import { createHealthRouter } from './health'
import { createMessagesRouter } from './messages'
import { createBotsRouter } from './bots'

export function createApiRoutes(
  messageQueueService: MessageQueueService,
  bots: Map<string, Bot>
): Router {
  const router = Router()

  router.use('/health', createHealthRouter())
  router.use('/messages', createMessagesRouter(messageQueueService, bots))
  router.use('/bots', createBotsRouter(bots))

  return router
}
