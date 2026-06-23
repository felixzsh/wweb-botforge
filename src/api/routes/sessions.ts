import { Router } from 'express'
import { SessionManager } from '../../whatsapp/session'
import { getLogger } from '../../helpers/logger'

export function createSessionsRouter(): Router {
  const router = Router()
  const sessionManager = SessionManager.getInstance()
  const logger = getLogger()

  router.post('/:id', async (req, res) => {
    try {
      const { id } = req.params

      const existingInfo = sessionManager.getSessionInfo(id)

      if (existingInfo?.state === 'connected') {
        return res.status(409).json({
          error: `Session "${id}" is already authenticated`,
          session: existingInfo,
        })
      }

      if (existingInfo && (existingInfo.state === 'qr_received' || existingInfo.state === 'pending')) {
        return res.json({
          success: true,
          id,
          session: existingInfo,
          note: 'Session already pending, subscribe to events',
        })
      }

      await sessionManager.registerSession(id)
      const info = sessionManager.getSessionInfo(id)

      res.json({
        success: true,
        id,
        session: info,
      })
    } catch (error: any) {
      logger.error('Error registering session:', error)
      res.status(500).json({ error: error.message || 'Internal server error' })
    }
  })

  router.get('/:id', (req, res) => {
    const { id } = req.params
    const info = sessionManager.getSessionInfo(id)

    if (!info) {
      return res.status(404).json({ error: `Session "${id}" not found` })
    }

    res.json({ id, session: info })
  })

  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params

      if (!sessionManager.hasChannel(id)) {
        return res.status(404).json({ error: `Session "${id}" not found` })
      }

      await sessionManager.removeChannel(id)
      res.json({ success: true, id })
    } catch (error: any) {
      logger.error('Error removing session:', error)
      res.status(500).json({ error: error.message || 'Internal server error' })
    }
  })

  router.get('/:id/events', (req, res) => {
    const { id } = req.params

    if (!sessionManager.hasChannel(id)) {
      return res.status(404).json({ error: `Session "${id}" not found` })
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const handler = (event: any) => {
      try {
        res.write(`event: ${event.type}\n`)
        res.write(`data: ${JSON.stringify(event.data ?? {})}\n\n`)
      } catch {
        // connection closed
      }
    }

    sessionManager.onSessionEvent(id, handler)

    req.on('close', () => {
      sessionManager.removeSessionEventListener(id, handler)
    })
  })

  router.get('/', (req, res) => {
    const sessions = Array.from(sessionManager.getAllSessions().entries()).map(([id, info]) => ({
      id,
      ...info,
    }))
    res.json({ sessions, total: sessions.length })
  })

  return router
}
