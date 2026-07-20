import { Router } from 'express'

export function createHealthRouter(): Router {
  const router = Router()

  router.get('/', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Botforje-js API',
    })
  })

  return router
}
