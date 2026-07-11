import { Router } from 'express'
import { AuthService } from '../../auth/service'

function parseCookie(cookie: string | undefined, name: string): string | null {
  if (!cookie) return null
  for (const part of cookie.split(';')) {
    const trimmed = part.trim()
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    if (trimmed.slice(0, eqIdx) === name) {
      return trimmed.slice(eqIdx + 1)
    }
  }
  return null
}

export function createAuthRouter(authService: AuthService): Router {
  const router = Router()

  router.post('/login', (req, res) => {
    const { key } = req.body
    if (!key || typeof key !== 'string') {
      res.status(400).json({ error: 'key is required' })
      return
    }

    if (!authService.isLocked()) {
      res.status(400).json({ error: 'Auth is not enabled. Run `botforje lock` first.' })
      return
    }

    if (!authService.verifyKey(key)) {
      res.status(401).json({ error: 'Invalid key' })
      return
    }

    const session = authService.createSession()
    res.setHeader(
      'Set-Cookie',
      `botforje_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`
    )
    res.json({ success: true, expiresAt: session.expiresAt })
  })

  router.post('/logout', (req, res) => {
    const token = parseCookie(req.headers.cookie, 'botforje_session')
    if (token) {
      authService.invalidateSession(token)
    }
    res.setHeader(
      'Set-Cookie',
      'botforje_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
    )
    res.json({ success: true })
  })

  return router
}

export function findSessionToken(authService: AuthService, cookieHeader: string | undefined): string | null {
  const token = parseCookie(cookieHeader, 'botforje_session')
  if (!token) return null
  const session = authService.validateSession(token)
  return session ? token : null
}
