/**
 * Represents a message to be sent through a channel
 * This is a domain value object that encapsulates the structure of outgoing messages
 * independent of any external framework or infrastructure
 */
export class OutgoingMessage {
  private constructor(
    private readonly to: string,
    private readonly content: string,
    private readonly metadata?: Record<string, any>
  ) {
    if (!to || to.trim().length === 0) {
      throw new Error('Recipient (to) cannot be empty');
    }
    if (!content || content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }
  }

  static create(
    to: string,
    content: string,
    metadata?: Record<string, any>
  ): OutgoingMessage {
    return new OutgoingMessage(to, content, metadata);
  }

  getTo(): string {
    return this.to;
  }

  getContent(): string {
    return this.content;
  }

  getMetadata(): Record<string, any> | undefined {
    return this.metadata;
  }

  /**
   * Convert to a plain object for serialization
   */
  toPlainObject(): {
    to: string;
    content: string;
    metadata?: Record<string, any>;
  } {
    return {
      to: this.to,
      content: this.content,
      ...(this.metadata && { metadata: this.metadata })
    };
  }
}
