import { Router } from 'express';

export function createHealthRouter(): Router {
  const router = Router();

  // Health check endpoint
  router.get('/', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'WWeb BotForge API'
    });
  });

  return router;
}