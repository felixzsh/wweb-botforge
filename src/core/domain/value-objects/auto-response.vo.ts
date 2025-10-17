import { ResponsePattern } from './response-pattern.vo';

export interface AutoResponseProps {
  pattern: ResponsePattern;
  response: string;
  priority: number;
  cooldown?: number;
  mediaUrl?: string;
  caption?: string;
}

export class AutoResponse {
  private constructor(private readonly props: AutoResponseProps) {
    if (props.priority < 0) {
      throw new Error('Priority must be non-negative');
    }
    if (!props.response || props.response.trim().length === 0) {
      throw new Error('Response cannot be empty');
    }
  }

  static create(props: AutoResponseProps): AutoResponse {
    return new AutoResponse(props);
  }

  matches(message: string): boolean {
    return this.props.pattern.matches(message);
  }

  get pattern(): ResponsePattern {
    return this.props.pattern;
  }

  get response(): string {
    return this.props.response;
  }

  get priority(): number {
    return this.props.priority;
  }

  get cooldown(): number | undefined {
    return this.props.cooldown;
  }

  get mediaUrl(): string | undefined {
    return this.props.mediaUrl;
  }

  get caption(): string | undefined {
    return this.props.caption;
  }
}