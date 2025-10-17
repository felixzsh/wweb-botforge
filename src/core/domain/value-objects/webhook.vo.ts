import { ResponsePattern } from './response-pattern.vo';

export interface WebhookProps {
  name: string;
  pattern: ResponsePattern;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  priority?: number;
  cooldown?: number;
}

export class Webhook {
  private constructor(private readonly props: WebhookProps) {
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Webhook name cannot be empty');
    }
    if (!props.url || props.url.trim().length === 0) {
      throw new Error('Webhook URL cannot be empty');
    }
    if (props.priority !== undefined && props.priority < 0) {
      throw new Error('Priority must be non-negative');
    }
  }

  static create(props: WebhookProps): Webhook {
    return new Webhook(props);
  }

  matches(text: string): boolean {
    return this.props.pattern.matches(text);
  }

  get name(): string {
    return this.props.name;
  }

  get pattern(): ResponsePattern {
    return this.props.pattern;
  }

  get url(): string {
    return this.props.url;
  }

  get method(): 'GET' | 'POST' | 'PUT' | 'PATCH' {
    return this.props.method;
  }

  get headers(): Record<string, string> {
    return this.props.headers ?? {};
  }

  get timeout(): number {
    return this.props.timeout ?? 5000;
  }

  get retries(): number {
    return this.props.retries ?? 3;
  }

  get priority(): number {
    return this.props.priority ?? 1;
  }

  get cooldown(): number | undefined {
    return this.props.cooldown;
  }
}