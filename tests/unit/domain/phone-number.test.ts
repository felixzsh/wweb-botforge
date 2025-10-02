import { PhoneNumber } from '../../../src/core/domain/value-objects/phone-number.vo';

describe('PhoneNumber', () => {
  describe('constructor', () => {
    it('should create a valid PhoneNumber', () => {
      const phone = new PhoneNumber('+521234567890');
      expect(phone.value).toBe('+521234567890');
    });

    it('should throw error for invalid phone number', () => {
      expect(() => new PhoneNumber('1234567890')).toThrow('Invalid phone number format');
      expect(() => new PhoneNumber('+52')).toThrow('Invalid phone number format');
      expect(() => new PhoneNumber('invalid')).toThrow('Invalid phone number format');
    });
  });

  describe('toString', () => {
    it('should return the value', () => {
      const phone = new PhoneNumber('+521234567890');
      expect(phone.toString()).toBe('+521234567890');
    });
  });
});