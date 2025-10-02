export class Webhook {
  constructor(
    public name: string,
    public pattern: string,
    public url: string,
    public method: 'GET' | 'POST' | 'PUT' | 'PATCH' = 'POST',
    public headers: Record<string, string> = {},
    public timeout: number = 5000,
    public retry: number = 3,
    public priority: number = 1
  ) {}

  matches(message: string): boolean {
    const regex = new RegExp(this.pattern, 'i');
    return regex.test(message);
  }
}
