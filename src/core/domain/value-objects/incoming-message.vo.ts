import { PhoneNumber } from './phone-number.vo';

/**
 * Value Object representing an incoming message in the domain
 * This is a domain concept, not tied to any external infrastructure
 */
export class IncomingMessage {
  private constructor(
    private readonly _id: string,
    private readonly _from: PhoneNumber,
    private readonly _to: PhoneNumber,
    private readonly _content: string,
    private readonly _timestamp: Date,
    private readonly _metadata?: Record<string, any>
  ) {}

  static create(
    id: string,
    from: PhoneNumber,
    to: PhoneNumber,
    content: string,
    timestamp: Date,
    metadata?: Record<string, any>
  ): IncomingMessage {
    if (!content || content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }
    return new IncomingMessage(id, from, to, content, timestamp, metadata);
  }

  get id(): string {
    return this._id;
  }

  get from(): PhoneNumber {
    return this._from;
  }

  get to(): PhoneNumber {
    return this._to;
  }

  get content(): string {
    return this._content;
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  get metadata(): Record<string, any> | undefined {
    return this._metadata;
  }

  /**
   * Check if this message was sent by the bot itself
   */
  isFromBot(botPhoneNumber: PhoneNumber): boolean {
    return this._from.getValue() === botPhoneNumber.getValue();
  }

  /**
   * Check if this message is from a group
   */
  isFromGroup(): boolean {
    return this._metadata?.isGroup === true;
  }
}
