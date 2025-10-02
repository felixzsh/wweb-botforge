import { Bot } from '../entities/bot.entity';
import { BotId } from '../value-objects/bot-id.vo';

export interface IBotRepository {
  findAll(): Promise<Bot[]>;
  findById(id: BotId): Promise<Bot | null>;
  save(bot: Bot): Promise<void>;
  delete(id: BotId): Promise<void>;
}
