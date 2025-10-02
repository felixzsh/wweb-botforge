import { Bot } from '../entities/bot.entity';

export interface IBotFactory {
  createFromConfig(config: any): Bot;
}