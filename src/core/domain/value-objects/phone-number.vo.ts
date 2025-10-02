export class PhoneNumber {
  constructor(public readonly value: string) {
    if (!this.isValidPhoneNumber(value)) {
      throw new Error('Invalid phone number format');
    }
  }

  private isValidPhoneNumber(phone: string): boolean {
    // Validación básica de número internacional
    return /^\+\d{10,15}$/.test(phone);
  }

  toString(): string {
    return this.value;
  }
}
