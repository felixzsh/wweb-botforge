import { Bot } from '../entities/bot.entity';
import { BotConfiguration } from '../entities/config.entity';

export interface IBotFactory {
  createFromConfig(config: BotConfiguration): Bot;
  createBots(configs: BotConfiguration[]): Bot[];
}