export class BotId {
  constructor(public readonly value: string) {
    if (!value || value.length < 3) {
      throw new Error('Bot ID must be at least 3 characters long');
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      throw new Error('Bot ID can only contain lowercase letters, numbers and hyphens');
    }
  }

  equals(other: BotId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}