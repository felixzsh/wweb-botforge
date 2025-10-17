import { Bot } from '../../domain/entities/bot.entity';
import { BotConfigDTO } from '../dtos/config-file.dto';
import { BotConfigMapper } from '../mappers/bot-config.mapper';
import { getLogger } from '../../infrastructure/logger';

/**
 * Load and map bot configurations from DTOs to domain entities
 * @param botConfigs - Array of bot configuration DTOs
 * @returns Promise resolving to array of Bot domain entities
 */
export async function loadBotsFromConfig(botConfigs: BotConfigDTO[]): Promise<Bot[]> {
  const logger = getLogger();

  try {
    logger.info('📂 Loading bot configurations...');

    if (!botConfigs || botConfigs.length === 0) {
      logger.warn('⚠️  No bots found in configuration');
      return [];
    }

    // Map DTOs to domain entities
    const bots = botConfigs.map((botConfig) => {
      try {
        return BotConfigMapper.toDomain(botConfig);
      } catch (error) {
        logger.error(`❌ Failed to map bot configuration for "${botConfig.id}":`, error);
        throw error;
      }
    });

    logger.info(`✅ Successfully loaded ${bots.length} bot(s)`);
    return bots;
  } catch (error) {
    logger.error('❌ Error loading bot configurations:', error);
    throw error;
  }
}
