export class ResponsePattern {
  private readonly regex: RegExp;

  private constructor(
    private readonly pattern: string,
    private readonly caseInsensitive: boolean
  ) {
    try {
      const flags = caseInsensitive ? 'i' : '';
      this.regex = new RegExp(pattern, flags);
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${pattern}`);
    }
  }

  static create(pattern: string, caseInsensitive: boolean = false): ResponsePattern {
    return new ResponsePattern(pattern, caseInsensitive);
  }

  matches(text: string): boolean {
    return this.regex.test(text);
  }

  getPattern(): string {
    return this.pattern;
  }

  isCaseInsensitive(): boolean {
    return this.caseInsensitive;
  }
}
