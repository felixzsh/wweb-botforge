import { IConfigRepository } from '../../application/ports/iconfig-repository';
import { ConfigFileDTO, BotConfigDTO } from '../../application/dtos/config-file.dto';
import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getLogger } from '../utils/logger';

/**
 * YAML configuration repository adapter
 * Implements IConfigRepository to read/write YAML configuration files
 */
export class YamlConfigRepository implements IConfigRepository {
  private configPath: string;
  private watchers: Map<string, NodeJS.Timeout> = new Map();

  constructor(configPath?: string) {
    this.configPath = configPath || this.getDefaultConfigPath();
  }

  
  private get logger() {
    return getLogger();
  }

  /**
   * Get the configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Read configuration from YAML file
   */
  async read(): Promise<ConfigFileDTO> {
    try {
      const rawContent = await fs.readFile(this.configPath, 'utf-8');
      const processedContent = await this.processIncludes(rawContent, path.dirname(this.configPath));
      const config = yaml.load(processedContent) as ConfigFileDTO;

      if (!config.bots || !Array.isArray(config.bots)) {
        throw new Error('Configuration must contain a "bots" array');
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to read configuration from ${this.configPath}: ${error}`);
    }
  }

  /**
   * Process includes in YAML content
   */
  private async processIncludes(content: string, baseDir: string): Promise<string> {
    const lines = content.split('\n');
    const processedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const includeMatch = line.match(/^\s*-\s*!include\s+(.+)$/);
      if (includeMatch) {
        const includePath = path.resolve(baseDir, includeMatch[1]);
        const includedContent = await fs.readFile(includePath, 'utf8');
        // Add the dash and indent the content
        const indent = line.match(/^\s*/)?.[0] || '';
        const indentedContent = includedContent
          .split('\n')
          .map((line, index) => index === 0 ? indent + '- ' + line : indent + '  ' + line)
          .join('\n');
        processedLines.push(indentedContent);
      } else {
        processedLines.push(line);
      }
    }

    return processedLines.join('\n');
  }

  /**
   * Write configuration to YAML file (overwrites entire config)
   */
  async write(config: ConfigFileDTO): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      
      // Create directory if it doesn't exist
      if (!fsSync.existsSync(configDir)) {
        await fs.mkdir(configDir, { recursive: true });
      }

      const yamlContent = yaml.dump(config, {
        indent: 2,
        lineWidth: -1,
        noRefs: true
      });

      await fs.writeFile(this.configPath, yamlContent, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write configuration to ${this.configPath}: ${error}`);
    }
  }

  /**
   * Add a new bot configuration (append mode)
   * Reads existing config, adds the bot, and writes back
   */
  async addBotConfig(botConfig: BotConfigDTO): Promise<void> {
    try {
      // Read existing config
      let existingConfig: ConfigFileDTO;
      try {
        existingConfig = await this.read();
      } catch {
        // If file doesn't exist, create new config
        existingConfig = { bots: [] };
      }

      // Ensure bots array exists
      if (!existingConfig.bots) {
        existingConfig.bots = [];
      }

      // Check if bot already exists
      const existingBotIndex = existingConfig.bots.findIndex(
        (bot: BotConfigDTO) => bot.id === botConfig.id
      );

      if (existingBotIndex >= 0) {
        throw new Error(`Bot with ID "${botConfig.id}" already exists. Use updateBotConfig to modify it.`);
      }

      // Add new bot
      existingConfig.bots.push(botConfig);

      // Write updated config
      await this.write(existingConfig);
    } catch (error) {
      throw new Error(`Failed to add bot configuration: ${error}`);
    }
  }

  /**
   * Update an existing bot configuration
   * Reads existing config, updates the bot, and writes back
   */
  async updateBotConfig(botConfig: BotConfigDTO): Promise<void> {
    try {
      // Read existing config
      let existingConfig: ConfigFileDTO;
      try {
        existingConfig = await this.read();
      } catch {
        throw new Error('Configuration file does not exist. Cannot update non-existent bot.');
      }

      // Ensure bots array exists
      if (!existingConfig.bots) {
        existingConfig.bots = [];
      }

      // Check if bot exists
      const existingBotIndex = existingConfig.bots.findIndex(
        (bot: BotConfigDTO) => bot.id === botConfig.id
      );

      if (existingBotIndex < 0) {
        throw new Error(`Bot with ID "${botConfig.id}" not found. Use addBotConfig to create it.`);
      }

      // Update existing bot
      existingConfig.bots[existingBotIndex] = botConfig;

      // Write updated config
      await this.write(existingConfig);
    } catch (error) {
      throw new Error(`Failed to update bot configuration: ${error}`);
    }
  }

  /**
   * Watch for configuration file changes
   */
  watch(callback: (config: ConfigFileDTO) => void): void {
    if (this.watchers.has(this.configPath)) {
      return; // Already watching
    }

    const watcher = setInterval(async () => {
      try {
        const config = await this.read();
        callback(config);
      } catch (error) {
        console.error(`Error reading config during watch: ${error}`);
      }
    }, 1000); // Check every second

    this.watchers.set(this.configPath, watcher);
  }

  /**
   * Stop watching for configuration file changes
   */
  stopWatch(): void {
    for (const [path, watcher] of this.watchers.entries()) {
      clearInterval(watcher);
      this.watchers.delete(path);
    }
  }

  /**
   * Get default configuration path
   */
  private getDefaultConfigPath(): string {
    const home = process.env.HOME || os.homedir();
    return path.join(home, '.config', 'wweb-botforge', 'config.yml');
  }
}
