import { Bot, BotConfiguration } from '../entities/bot.entity';

export interface IBotFactory {
  createFromConfig(config: BotConfiguration): Bot;
  createBots(configs: BotConfiguration[]): Bot[];
}