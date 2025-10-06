import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { BotConfiguration } from '../domain/entities/config.entity';

/**
 * Service for loading bot configurations from YAML files
 */
export class ConfigLoaderService {
  private configPath: string;

  constructor(configPath: string = './config/main.yml') {
    this.configPath = path.resolve(configPath);
  }

  /**
   * Load bot configurations from YAML file
   */
  async loadBotConfigurations(): Promise<BotConfiguration[]> {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.warn(`⚠️  Configuration file not found: ${this.configPath}`);
        return [];
      }

      const content = fs.readFileSync(this.configPath, 'utf8');
      const config = yaml.load(content) as { bots?: BotConfiguration[] };

      if (!config || !config.bots || !Array.isArray(config.bots)) {
        console.warn('⚠️  No bots found in configuration file');
        return [];
      }

      console.log(`📋 Loaded ${config.bots.length} bot configuration(s)`);
      return config.bots;
    } catch (error) {
      console.error('❌ Error loading bot configurations:', error);
      throw new Error(`Failed to load bot configurations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate bot configuration
   */
  validateBotConfig(config: BotConfiguration): boolean {
    if (!config.id || typeof config.id !== 'string') {
      console.error(`❌ Invalid bot ID: ${config.id}`);
      return false;
    }

    if (!config.name || typeof config.name !== 'string') {
      console.error(`❌ Invalid bot name: ${config.name}`);
      return false;
    }

    return true;
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}