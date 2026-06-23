import { Router } from 'express'
import { Bot } from '../../bot'
import { SessionManager } from '../../whatsapp/session'
import { getLogger } from '../../helpers/logger'

export function createStatusRouter(bots: Map<string, Bot>): Router {
  const router = Router()
  const sessionManager = SessionManager.getInstance()

  router.get('/', (req, res) => {
    try {
      const logger = getLogger()

      const botStatuses = Array.from(bots.entries()).map(([id, bot]) => {
        const sessionInfo = sessionManager.getSessionInfo(id)

        return {
          id,
          flowsCount: bot.flows.length,
          phone: sessionInfo?.phone || bot.phone || null,
          session: sessionInfo ? {
            state: sessionInfo.state,
            lastQR: sessionInfo.lastQR ? true : false,
            error: sessionInfo.error || null,
          } : null,
        }
      })

      res.json({
        running: true,
        bots: botStatuses,
        total: botStatuses.length,
      })
    } catch (error) {
      getLogger().error('Error getting status:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  return router
}
