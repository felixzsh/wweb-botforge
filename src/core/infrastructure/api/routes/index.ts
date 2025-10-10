import { Router } from 'express';
import { MessageQueueService } from '../../../application/message-queue.service';
import { Bot } from '../../../domain/entities/bot.entity';
import { createHealthRouter } from './health';
import { createMessagesRouter } from './messages';
import { createBotsRouter } from './bots';

export function createApiRoutes(
  messageQueueService: MessageQueueService,
  bots: Map<string, Bot>
): Router {
  const router = Router();

  // Register all route modules
  router.use('/health', createHealthRouter());
  router.use('/messages', createMessagesRouter(messageQueueService, bots));
  router.use('/bots', createBotsRouter(bots));

  // Future routes can be added here easily:
  // router.use('/webhooks', createWebhooksRouter(webhookService));
  // router.use('/analytics', createAnalyticsRouter(analyticsService));
  // router.use('/admin', createAdminRouter(adminService));

  return router;
}