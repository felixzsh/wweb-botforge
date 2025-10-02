import { PhoneNumber } from '../value-objects/phone-number.vo';

export class BotSettings {
  constructor(
    public simulateTyping: boolean = true,
    public typingDelay: number = 1000,
    public readReceipts: boolean = true,
    public ignoreGroups: boolean = true,
    public adminNumbers: PhoneNumber[] = [],
    public logLevel: 'info' | 'debug' | 'warn' | 'error' = 'info'
  ) {}
}