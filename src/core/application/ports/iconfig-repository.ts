import { ConfigFileDTO, BotConfigDTO } from '../dtos/config-file.dto';

/**
 * Port (Interface) for reading and writing configuration
 * Infrastructure adapters must implement this interface
 */
export interface IConfigRepository {
  /**
   * Read configuration from source
   */
  read(): Promise<ConfigFileDTO>;

  /**
   * Write configuration to source (overwrites entire config)
   */
  write(config: ConfigFileDTO): Promise<void>;

  /**
   * Add a new bot configuration to the existing config
   * If bot with same ID exists, it will be added as new
   */
  addBotConfig(botConfig: BotConfigDTO): Promise<void>;

  /**
   * Update an existing bot configuration
   * If bot with same ID doesn't exist, throws error
   */
  updateBotConfig(botConfig: BotConfigDTO): Promise<void>;

  /**
   * Watch for configuration changes
   */
  watch(callback: (config: ConfigFileDTO) => void): void;
}
