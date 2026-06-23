import { Router } from 'express'
import { BotFleet } from '../../fleet'
import { ConfigWatcher } from '../../config/watcher'
import { getLogger } from '../../helpers/logger'

export function createConfigRouter(fleet: BotFleet, configWatcher: ConfigWatcher): Router {
  const router = Router()

  router.post('/reload', async (req, res) => {
    try {
      await configWatcher.reload()
      res.json({ success: true, message: 'Configuration reloaded' })
    } catch (error: any) {
      getLogger().error('Config reload error:', error)
      res.status(500).json({ error: error.message || 'Reload failed' })
    }
  })

  router.get('/status', (req, res) => {
    res.json({
      watching: configWatcher.isWatching(),
    })
  })

  return router
}
