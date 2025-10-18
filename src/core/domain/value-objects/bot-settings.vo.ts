export interface BotSettingsProps {
  simulateTyping: boolean;
  typingDelay: number;
  queueDelay: number;
  readReceipts: boolean;
  ignoreGroups: boolean;
  ignoredSenders: string[];
  adminNumbers: string[];
}

export class BotSettings {
  private constructor(private readonly props: BotSettingsProps) {
    if (props.typingDelay < 0) {
      throw new Error('Typing delay must be non-negative');
    }
    if (props.queueDelay < 0) {
      throw new Error('Queue delay must be non-negative');
    }
  }

  static create(props: BotSettingsProps): BotSettings {
    return new BotSettings(props);
  }

  static createDefault(): BotSettings {
    return new BotSettings({
      simulateTyping: true,
      typingDelay: 1000,
      queueDelay: 1000,
      readReceipts: true,
      ignoreGroups: true,
      ignoredSenders: [],
      adminNumbers: []
    });
  }

  get simulateTyping(): boolean {
    return this.props.simulateTyping;
  }

  get typingDelay(): number {
    return this.props.typingDelay;
  }

  get queueDelay(): number {
    return this.props.queueDelay;
  }

  get readReceipts(): boolean {
    return this.props.readReceipts;
  }

  get ignoreGroups(): boolean {
    return this.props.ignoreGroups;
  }

  get ignoredSenders(): string[] {
    return this.props.ignoredSenders;
  }

  get adminNumbers(): string[] {
    return this.props.adminNumbers;
  }

  isAdminNumber(phone: string): boolean {
    return this.props.adminNumbers.includes(phone);
  }

  isIgnoredSender(phone: string): boolean {
    return this.props.ignoredSenders.includes(phone);
  }
}