import { DatabaseSync } from 'node:sqlite'
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'

export interface Session {
  id: string
  token: string
  scopeBotIds: string[] | null
  createdAt: number
  expiresAt: number
}

export class AuthService {
  private db: DatabaseSync

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath)
    this.setupSchema()
  }

  private setupSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS key_hash (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        scope_bot_ids TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `)
  }

  isLocked(): boolean {
    const row = this.db.prepare('SELECT 1 FROM key_hash WHERE id = 1').get() as { '1': number } | undefined
    return !!row
  }

  lock(key?: string): string {
    if (this.isLocked()) {
      throw new Error('Botforje-js is already locked. Run `botforje-js unlock` first.')
    }

    const secret = key || randomBytes(32).toString('hex')
    if (secret.length < 32) {
      throw new Error('Key must be at least 32 characters long')
    }

    const hash = createHash('sha256').update(secret).digest('hex')
    this.db.prepare('INSERT OR REPLACE INTO key_hash (id, hash) VALUES (1, ?)').run(hash)
    this.invalidateAllSessions()

    return secret
  }

  unlock(providedKey: string): boolean {
    const stored = this.db.prepare('SELECT hash FROM key_hash WHERE id = 1').get() as { hash: string } | undefined
    if (!stored) return false

    const inputHash = createHash('sha256').update(providedKey).digest('hex')
    const match = timingSafeEqual(Buffer.from(inputHash), Buffer.from(stored.hash))

    if (match) {
      this.db.prepare('DELETE FROM key_hash WHERE id = 1').run()
      this.invalidateAllSessions()
    }

    return match
  }

  verifyKey(key: string): boolean {
    const stored = this.db.prepare('SELECT hash FROM key_hash WHERE id = 1').get() as { hash: string } | undefined
    if (!stored) return false

    const inputHash = createHash('sha256').update(key).digest('hex')
    return timingSafeEqual(Buffer.from(inputHash), Buffer.from(stored.hash))
  }

  createSession(scopeBotIds?: string[]): { token: string; expiresAt: number } {
    const id = randomBytes(16).toString('hex')
    const token = randomBytes(32).toString('hex')
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + 86400
    const scopeJson = scopeBotIds ? JSON.stringify(scopeBotIds) : null

    this.db.prepare(
      'INSERT INTO sessions (id, token, scope_bot_ids, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, token, scopeJson, now, expiresAt)

    return { token, expiresAt }
  }

  validateSession(token: string): Session | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) as SessionRow | undefined
    if (!row) return null

    const now = Math.floor(Date.now() / 1000)
    if (now > row.expires_at) {
      this.db.prepare('DELETE FROM sessions WHERE id = ?').run(row.id)
      return null
    }

    return {
      id: row.id,
      token: row.token,
      scopeBotIds: row.scope_bot_ids ? JSON.parse(row.scope_bot_ids) : null,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }
  }

  invalidateSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  }

  invalidateAllSessions(): void {
    this.db.prepare('DELETE FROM sessions').run()
  }

  close(): void {
    this.db.close()
  }
}

interface SessionRow {
  id: string
  token: string
  scope_bot_ids: string | null
  created_at: number
  expires_at: number
}
