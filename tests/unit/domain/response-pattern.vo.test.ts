import { ResponsePattern } from '../../../src/core/domain/value-objects/response-pattern.vo';

describe('ResponsePattern Value Object', () => {
  describe('create', () => {
    it('should create a valid ResponsePattern with case-sensitive pattern', () => {
      const pattern = ResponsePattern.create('hello', false);
      expect(pattern).toBeDefined();
      expect(pattern.getPattern()).toBe('hello');
      expect(pattern.isCaseInsensitive()).toBe(false);
    });

    it('should create a valid ResponsePattern with case-insensitive pattern', () => {
      const pattern = ResponsePattern.create('hello', true);
      expect(pattern).toBeDefined();
      expect(pattern.getPattern()).toBe('hello');
      expect(pattern.isCaseInsensitive()).toBe(true);
    });

    it('should create a valid ResponsePattern with regex special characters', () => {
      const pattern = ResponsePattern.create('\\b(hello|hi)\\b', false);
      expect(pattern).toBeDefined();
      expect(pattern.getPattern()).toBe('\\b(hello|hi)\\b');
    });

    it('should throw error for invalid regex pattern', () => {
      expect(() => ResponsePattern.create('[invalid(regex', false)).toThrow('Invalid regex pattern');
    });

    it('should throw error for unclosed character class', () => {
      expect(() => ResponsePattern.create('[abc', false)).toThrow('Invalid regex pattern');
    });

    it('should throw error for invalid quantifier', () => {
      expect(() => ResponsePattern.create('*invalid', false)).toThrow('Invalid regex pattern');
    });
  });

  describe('matches', () => {
    it('should match simple string pattern', () => {
      const pattern = ResponsePattern.create('hello', false);
      expect(pattern.matches('hello')).toBe(true);
      expect(pattern.matches('Hello')).toBe(false);
      expect(pattern.matches('hello world')).toBe(true);
    });

    it('should match case-insensitive pattern', () => {
      const pattern = ResponsePattern.create('hello', true);
      expect(pattern.matches('hello')).toBe(true);
      expect(pattern.matches('Hello')).toBe(true);
      expect(pattern.matches('HELLO')).toBe(true);
      expect(pattern.matches('HeLLo')).toBe(true);
    });

    it('should match regex word boundary pattern', () => {
      const pattern = ResponsePattern.create('\\bhello\\b', false);
      expect(pattern.matches('hello')).toBe(true);
      expect(pattern.matches('hello world')).toBe(true);
      expect(pattern.matches('say hello there')).toBe(true);
      expect(pattern.matches('helloworld')).toBe(false);
    });

    it('should match alternation pattern', () => {
      const pattern = ResponsePattern.create('(hello|hi|hey)', false);
      expect(pattern.matches('hello')).toBe(true);
      expect(pattern.matches('hi')).toBe(true);
      expect(pattern.matches('hey')).toBe(true);
      expect(pattern.matches('goodbye')).toBe(false);
    });

    it('should match case-insensitive alternation pattern', () => {
      const pattern = ResponsePattern.create('(hello|hi|hey)', true);
      expect(pattern.matches('HELLO')).toBe(true);
      expect(pattern.matches('Hi')).toBe(true);
      expect(pattern.matches('HEY')).toBe(true);
    });

    it('should match complex regex pattern', () => {
      const pattern = ResponsePattern.create('\\b(price|cost|pricing|fee)\\b', true);
      expect(pattern.matches('What is the price?')).toBe(true);
      expect(pattern.matches('Tell me the COST')).toBe(true);
      expect(pattern.matches('pricing information')).toBe(true);
      expect(pattern.matches('What is the fee?')).toBe(true);
      expect(pattern.matches('expensive')).toBe(false);
    });

    it('should match pattern with quantifiers', () => {
      const pattern = ResponsePattern.create('a+', false);
      expect(pattern.matches('a')).toBe(true);
      expect(pattern.matches('aaa')).toBe(true);
      expect(pattern.matches('b')).toBe(false);
    });

    it('should match pattern with optional characters', () => {
      const pattern = ResponsePattern.create('colou?r', false);
      expect(pattern.matches('color')).toBe(true);
      expect(pattern.matches('colour')).toBe(true);
      expect(pattern.matches('colr')).toBe(false);
    });

    it('should match pattern with character class', () => {
      const pattern = ResponsePattern.create('[0-9]+', false);
      expect(pattern.matches('123')).toBe(true);
      expect(pattern.matches('abc123')).toBe(true);
      expect(pattern.matches('abc')).toBe(false);
    });

    it('should match pattern with negated character class', () => {
      const pattern = ResponsePattern.create('[^0-9]+', false);
      expect(pattern.matches('abc')).toBe(true);
      expect(pattern.matches('abc123')).toBe(true);
      expect(pattern.matches('123')).toBe(false);
    });

    it('should match wildcard pattern', () => {
      const pattern = ResponsePattern.create('.*', false);
      expect(pattern.matches('anything')).toBe(true);
      expect(pattern.matches('')).toBe(true);
      expect(pattern.matches('123!@#')).toBe(true);
    });

    it('should not match empty string when pattern requires content', () => {
      const pattern = ResponsePattern.create('.+', false);
      expect(pattern.matches('')).toBe(false);
      expect(pattern.matches('a')).toBe(true);
    });
  });

  describe('getPattern', () => {
    it('should return the original pattern string', () => {
      const patternStr = '\\b(hello|hi)\\b';
      const pattern = ResponsePattern.create(patternStr, false);
      expect(pattern.getPattern()).toBe(patternStr);
    });
  });

  describe('isCaseInsensitive', () => {
    it('should return false for case-sensitive pattern', () => {
      const pattern = ResponsePattern.create('hello', false);
      expect(pattern.isCaseInsensitive()).toBe(false);
    });

    it('should return true for case-insensitive pattern', () => {
      const pattern = ResponsePattern.create('hello', true);
      expect(pattern.isCaseInsensitive()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty pattern', () => {
      const pattern = ResponsePattern.create('', false);
      expect(pattern.matches('')).toBe(true);
      expect(pattern.matches('anything')).toBe(true);
    });

    it('should handle pattern with special regex characters', () => {
      const pattern = ResponsePattern.create('\\$\\d+', false);
      expect(pattern.matches('$100')).toBe(true);
      expect(pattern.matches('100')).toBe(false);
    });

    it('should handle pattern with escaped characters', () => {
      const pattern = ResponsePattern.create('\\(hello\\)', false);
      expect(pattern.matches('(hello)')).toBe(true);
      expect(pattern.matches('hello')).toBe(false);
    });

    it('should handle multiline content', () => {
      const pattern = ResponsePattern.create('hello', false);
      expect(pattern.matches('hello\nworld')).toBe(true);
      expect(pattern.matches('world\nhello')).toBe(true);
    });

    it('should handle unicode characters', () => {
      const pattern = ResponsePattern.create('hola', true);
      expect(pattern.matches('Hola')).toBe(true);
      expect(pattern.matches('HOLA')).toBe(true);
    });

    it('should handle pattern with lookahead', () => {
      const pattern = ResponsePattern.create('hello(?=world)', false);
      expect(pattern.matches('helloworld')).toBe(true);
      expect(pattern.matches('hello there')).toBe(false);
    });

    it('should handle pattern with lookbehind', () => {
      const pattern = ResponsePattern.create('(?<=hello)world', false);
      expect(pattern.matches('helloworld')).toBe(true);
      expect(pattern.matches('world')).toBe(false);
    });
  });
});
