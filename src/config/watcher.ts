import * as fs from 'fs'
import * as path from 'path'
import { loadConfig, getConfigPath } from './yaml'
import { BotFleet } from '../fleet'
import { mapActionCatalog, mapFlowCatalog, mapBotsFromConfig } from './mapper'
import { getLogger } from '../helpers/logger'

export class ConfigWatcher {
  private watcher: fs.FSWatcher | null = null
  private fleet: BotFleet
  private configDir: string
  private debounceTimer: NodeJS.Timeout | null = null
  private watching: boolean = false

  constructor(fleet: BotFleet, configPath?: string) {
    this.fleet = fleet
    const resolvedPath = configPath || getConfigPath()
    this.configDir = path.dirname(resolvedPath)
  }

  private get logger() {
    return getLogger()
  }

  start(): void {
    if (this.watching) return

    try {
      this.watcher = fs.watch(this.configDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return
        const ext = path.extname(filename)
        if (ext !== '.yml' && ext !== '.yaml') return

        if (this.debounceTimer) clearTimeout(this.debounceTimer)
        this.debounceTimer = setTimeout(() => {
          this.reload().catch(err => {
            this.logger.error('Config reload error:', err)
          })
        }, 500)
      })

      this.watching = true
      this.logger.info(`Config watcher started on ${this.configDir}`)
    } catch (error) {
      this.logger.warn('Failed to start config watcher:', error)
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.watching = false
  }

  isWatching(): boolean {
    return this.watching
  }

  async reload(): Promise<void> {
    try {
      this.logger.info('Reloading configuration...')

      const configFile = await loadConfig()
      const newActionCatalog = mapActionCatalog(configFile.actions || {})
      const newFlowCatalog = mapFlowCatalog(configFile.flows || {})
      const loadedBots = mapBotsFromConfig(configFile.bots)

      this.fleet.reloadCatalogs(newActionCatalog, newFlowCatalog)

      const existingBots = this.fleet.getBots()
      const existingIds = new Set(existingBots.keys())
      const newIds = new Set(loadedBots.map(b => b.id))

      for (const bot of loadedBots) {
        if (!existingIds.has(bot.id)) {
          existingBots.set(bot.id, bot)
          this.fleet.getOutboxService().setupBotQueue(bot)
          this.logger.info(`New bot added via reload: ${bot.id}`)
        }
      }

      for (const id of existingIds) {
        if (!newIds.has(id)) {
          const bot = existingBots.get(id)
          if (bot) {
            existingBots.delete(id)
            this.logger.info(`Bot removed via reload: ${id}`)
          }
        }
      }

      this.logger.info('Configuration reloaded successfully')
    } catch (error) {
      this.logger.error('Failed to reload configuration:', error)
    }
  }
}
