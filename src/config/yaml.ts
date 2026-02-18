import * as yaml from 'js-yaml'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as os from 'os'
import { ConfigFile, BotConfig } from '../bot/types'
import { getLogger } from '../utils/logger'

let configPath: string

function getDefaultConfigPath(): string {
  const home = process.env.HOME || os.homedir()
  return path.join(home, '.config', 'wweb-botforge', 'config.yml')
}

export function getConfigPath(): string {
  return configPath || getDefaultConfigPath()
}

export function setConfigPath(newPath: string): void {
  configPath = newPath
}

async function processIncludes(content: string, baseDir: string): Promise<string> {
  const lines = content.split('\n')
  const processedLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const includeMatch = line.match(/^\s*-\s*!include\s+(.+)$/)
    if (includeMatch) {
      const includePath = path.resolve(baseDir, includeMatch[1])
      const includedContent = await fs.readFile(includePath, 'utf8')
      const indent = line.match(/^\s*/)?.[0] || ''
      const indentedContent = includedContent
        .split('\n')
        .map((line, index) => index === 0 ? indent + '- ' + line : indent + '  ' + line)
        .join('\n')
      processedLines.push(indentedContent)
    } else {
      processedLines.push(line)
    }
  }

  return processedLines.join('\n')
}

export async function loadConfig(customPath?: string): Promise<ConfigFile> {
  const targetPath = customPath || getConfigPath()
  const logger = getLogger()

  try {
    const rawContent = await fs.readFile(targetPath, 'utf-8')
    const processedContent = await processIncludes(rawContent, path.dirname(targetPath))
    const config = yaml.load(processedContent) as ConfigFile

    if (!config.bots || !Array.isArray(config.bots)) {
      throw new Error('Configuration must contain a "bots" array')
    }

    return config
  } catch (error) {
    throw new Error(`Failed to read configuration from ${targetPath}: ${error}`)
  }
}

export async function saveConfig(config: ConfigFile, customPath?: string): Promise<void> {
  const targetPath = customPath || getConfigPath()

  try {
    const configDir = path.dirname(targetPath)

    if (!fsSync.existsSync(configDir)) {
      await fs.mkdir(configDir, { recursive: true })
    }

    const yamlContent = yaml.dump(config, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    })

    await fs.writeFile(targetPath, yamlContent, 'utf-8')
  } catch (error) {
    throw new Error(`Failed to write configuration to ${targetPath}: ${error}`)
  }
}

export async function addBotConfig(botConfig: BotConfig, customPath?: string): Promise<void> {
  const logger = getLogger()

  try {
    let existingConfig: ConfigFile
    try {
      existingConfig = await loadConfig(customPath)
    } catch {
      existingConfig = { bots: [] }
    }

    if (!existingConfig.bots) {
      existingConfig.bots = []
    }

    const existingBotIndex = existingConfig.bots.findIndex(
      (bot: BotConfig) => bot.id === botConfig.id
    )

    if (existingBotIndex >= 0) {
      throw new Error(`Bot with ID "${botConfig.id}" already exists. Use updateBotConfig to modify it.`)
    }

    existingConfig.bots.push(botConfig)

    await saveConfig(existingConfig, customPath)
  } catch (error) {
    throw new Error(`Failed to add bot configuration: ${error}`)
  }
}

export async function updateBotConfig(botConfig: BotConfig, customPath?: string): Promise<void> {
  try {
    let existingConfig: ConfigFile
    try {
      existingConfig = await loadConfig(customPath)
    } catch {
      throw new Error('Configuration file does not exist. Cannot update non-existent bot.')
    }

    if (!existingConfig.bots) {
      existingConfig.bots = []
    }

    const existingBotIndex = existingConfig.bots.findIndex(
      (bot: BotConfig) => bot.id === botConfig.id
    )

    if (existingBotIndex < 0) {
      throw new Error(`Bot with ID "${botConfig.id}" not found. Use addBotConfig to create it.`)
    }

    existingConfig.bots[existingBotIndex] = botConfig

    await saveConfig(existingConfig, customPath)
  } catch (error) {
    throw new Error(`Failed to update bot configuration: ${error}`)
  }
}
