import { Bot, BotSettings, FlowRef } from './bot'
import { BotConfig, BotSettingsConfig, FlowRefConfig } from '../config/schema'
import { createBot, createDefaultSettings } from './bot'
import { validateId, validatePriority, validateTypingDelay, validateQueueDelay } from '../utils/validation'

export function mapConfigToBot(id: string, config: BotConfig): Bot {
  validateId(id, 'Bot')

  const settings = config.settings ? mapSettings(config.settings) : createDefaultSettings()
  const flows = (config.flows || []).map(mapFlowRef)

  return createBot({
    id,
    settings,
    flows,
  })
}

export function mapFlowRef(config: FlowRefConfig): FlowRef {
  if (config.priority !== undefined) {
    validatePriority(config.priority)
  }

  return {
    id: config.id,
    priority: config.priority ?? 1,
  }
}

export function mapSettings(config: BotSettingsConfig): BotSettings {
  if (config.typing_delay !== undefined) {
    validateTypingDelay(config.typing_delay)
  }
  if (config.queue_delay !== undefined) {
    validateQueueDelay(config.queue_delay)
  }

  return {
    simulateTyping: config.simulate_typing ?? true,
    typingDelay: config.typing_delay ?? 1000,
    queueDelay: config.queue_delay ?? 1000,
    readReceipts: config.read_receipts ?? true,
    ignoreGroups: config.ignore_groups ?? true,
    ignoredSenders: config.ignored_senders || [],
    adminNumbers: config.admin_numbers || [],
  }
}

export function mapBotsFromConfig(configs: Record<string, BotConfig>): Bot[] {
  return Object.entries(configs).map(([id, config]) => mapConfigToBot(id, config))
}
