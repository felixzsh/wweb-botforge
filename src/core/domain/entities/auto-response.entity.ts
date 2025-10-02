export class AutoResponse {
  constructor(
    public pattern: string,
    public response: string,
    public caseInsensitive: boolean = false,
    public priority: number = 1
  ) {}

  matches(message: string): boolean {
    const flags = this.caseInsensitive ? 'i' : '';
    const regex = new RegExp(this.pattern, flags);
    return regex.test(message);
  }
}