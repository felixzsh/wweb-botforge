import { Router } from 'express'
import { Bot } from '../../bot/bot'

export function createBotsRouter(bots: Map<string, Bot>): Router {
  const router = Router()

  router.get('/', (req, res) => {
    try {
      const botList = Array.from(bots.values()).map(bot => ({
        id: bot.id,
        phone: bot.phone,
        flowsCount: bot.flows.length,
        settings: bot.settings,
      }))

      res.json({
        bots: botList,
        total: botList.length,
      })
    } catch (error) {
      console.error('Error getting bots:', error)
      res.status(500).json({
        error: 'Internal server error',
      })
    }
  })

  router.get('/:botId', (req, res) => {
    try {
      const { botId } = req.params

      if (!bots.has(botId)) {
        return res.status(404).json({
          error: `Bot with id '${botId}' not found`,
        })
      }

      const bot = bots.get(botId)!
      res.json({
        id: bot.id,
        phone: bot.phone,
        flows: bot.flows,
        settings: bot.settings,
      })
    } catch (error) {
      console.error('Error getting bot:', error)
      res.status(500).json({
        error: 'Internal server error',
      })
    }
  })

  return router
}
