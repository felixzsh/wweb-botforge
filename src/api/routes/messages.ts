import { Router } from 'express'
import { MessageQueueService } from '../../services/message-queue'
import { Bot } from '../../bot/types'

export function createMessagesRouter(
  messageQueueService: MessageQueueService,
  bots: Map<string, Bot>
): Router {
  const router = Router()

  router.post('/send', (req, res) => {
    try {
      const { botId, to, content, metadata } = req.body

      if (!botId || !to || !content) {
        return res.status(400).json({
          error: 'Missing required fields: botId, to, content',
        })
      }

      if (!bots.has(botId)) {
        return res.status(404).json({
          error: `Bot with id '${botId}' not found`,
        })
      }

      const messageId = messageQueueService.enqueue(botId, to, content, metadata)

      res.json({
        success: true,
        messageId,
        botId,
        queued: true,
      })
    } catch (error) {
      console.error('Error sending message:', error)
      res.status(500).json({
        error: 'Internal server error',
      })
    }
  })

  router.get('/queue/:botId', (req, res) => {
    try {
      const { botId } = req.params

      if (!bots.has(botId)) {
        return res.status(404).json({
          error: `Bot with id '${botId}' not found`,
        })
      }

      const queueStatus = messageQueueService.getBotQueueStatus(botId)

      res.json({
        botId,
        queue: queueStatus,
      })
    } catch (error) {
      console.error('Error getting queue status:', error)
      res.status(500).json({
        error: 'Internal server error',
      })
    }
  })

  router.get('/queue', (req, res) => {
    try {
      const queueStatus = messageQueueService.getAllQueuesStatus()
      res.json(queueStatus)
    } catch (error) {
      console.error('Error getting all queues status:', error)
      res.status(500).json({
        error: 'Internal server error',
      })
    }
  })

  return router
}
