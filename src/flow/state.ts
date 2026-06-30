import { DatabaseSync } from 'node:sqlite'
import { FlowState } from './flow'

export class FlowStateService {
  private db: DatabaseSync

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath)
    this.setupSchema()
  }

  private setupSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS flow_states (
        id TEXT PRIMARY KEY,
        sender TEXT NOT NULL,
        bot_id TEXT NOT NULL,
        flow_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        variables TEXT NOT NULL DEFAULT '{}',
        started_at INTEGER NOT NULL,
        last_activity_at INTEGER NOT NULL,
        timeout INTEGER NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_flow_states_sender_bot ON flow_states(sender, bot_id);
      CREATE INDEX IF NOT EXISTS idx_flow_states_last_activity ON flow_states(last_activity_at);
    `)
  }

  findActive(sender: string, botId: string, now: number = Date.now()): FlowState | null {
    const row = this.db
      .prepare('SELECT * FROM flow_states WHERE sender = ? AND bot_id = ?')
      .get(sender, botId) as FlowStateRow | undefined

    if (!row) {
      return null
    }

    const state = this.rowToState(row)

    if (this.isExpired(state, now)) {
      this.destroy(state.id)
      return null
    }

    return state
  }

  create(
    sender: string,
    botId: string,
    flowId: string,
    stepId: string,
    timeout: number,
    now: number = Date.now(),
    initialVariables?: Record<string, any>
  ): FlowState {
    this.destroyBySenderBot(sender, botId)

    const id = `${botId}-${sender}-${now}`
    const state: FlowState = {
      id,
      sender,
      botId,
      flowId,
      stepId,
      variables: { ...initialVariables },
      startedAt: now,
      lastActivityAt: now,
      timeout,
    }

    this.db
      .prepare(
        'INSERT INTO flow_states (id, sender, bot_id, flow_id, step_id, variables, started_at, last_activity_at, timeout) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        state.id,
        state.sender,
        state.botId,
        state.flowId,
        state.stepId,
        JSON.stringify(state.variables),
        state.startedAt,
        state.lastActivityAt,
        state.timeout
      )

    return state
  }

  updateStep(id: string, stepId: string, variables?: Record<string, any>, now: number = Date.now()): void {
    const state = this.findById(id)
    if (!state) {
      return
    }

    const mergedVariables = variables ? { ...state.variables, ...variables } : state.variables

    this.db
      .prepare(
        'UPDATE flow_states SET step_id = ?, variables = ?, last_activity_at = ? WHERE id = ?'
      )
      .run(stepId, JSON.stringify(mergedVariables), now, id)
  }

  destroy(id: string): void {
    this.db.prepare('DELETE FROM flow_states WHERE id = ?').run(id)
  }

  destroyBySenderBot(sender: string, botId: string): void {
    this.db.prepare('DELETE FROM flow_states WHERE sender = ? AND bot_id = ?').run(sender, botId)
  }

  cleanupExpired(now: number = Date.now()): number {
    const cutoff = now
    const result = this.db
      .prepare('DELETE FROM flow_states WHERE (last_activity_at + (timeout * 1000)) < ?')
      .run(cutoff)

    return Number(result.changes)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM flow_states').get() as { count: number }
    return row.count
  }

  close(): void {
    this.db.close()
  }

  private findById(id: string): FlowState | null {
    const row = this.db.prepare('SELECT * FROM flow_states WHERE id = ?').get(id) as FlowStateRow | undefined
    return row ? this.rowToState(row) : null
  }

  private rowToState(row: FlowStateRow): FlowState {
    return {
      id: row.id,
      sender: row.sender,
      botId: row.bot_id,
      flowId: row.flow_id,
      stepId: row.step_id,
      variables: JSON.parse(row.variables || '{}'),
      startedAt: row.started_at,
      lastActivityAt: row.last_activity_at,
      timeout: row.timeout,
    }
  }

  private isExpired(state: FlowState, now: number): boolean {
    if (state.timeout <= 0) {
      return false
    }
    return now > state.lastActivityAt + state.timeout * 1000
  }
}

interface FlowStateRow {
  id: string
  sender: string
  bot_id: string
  flow_id: string
  step_id: string
  variables: string
  started_at: number
  last_activity_at: number
  timeout: number
}
