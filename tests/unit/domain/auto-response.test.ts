import { AutoResponse } from '../../../src/core/domain/entities/auto-response.entity';

describe('AutoResponse', () => {
  describe('constructor', () => {
    it('should create an AutoResponse with default values', () => {
      const response = new AutoResponse('hello', 'Hi there!');
      expect(response.pattern).toBe('hello');
      expect(response.response).toBe('Hi there!');
      expect(response.caseInsensitive).toBe(false);
      expect(response.priority).toBe(1);
    });

    it('should create an AutoResponse with custom values', () => {
      const response = new AutoResponse('HELLO', 'Hi!', true, 5);
      expect(response.pattern).toBe('HELLO');
      expect(response.response).toBe('Hi!');
      expect(response.caseInsensitive).toBe(true);
      expect(response.priority).toBe(5);
    });
  });

  describe('matches', () => {
    it('should match exact pattern', () => {
      const response = new AutoResponse('hello', 'Hi!');
      expect(response.matches('hello')).toBe(true);
      expect(response.matches('Hello')).toBe(false);
    });

    it('should match case insensitive', () => {
      const response = new AutoResponse('hello', 'Hi!', true);
      expect(response.matches('hello')).toBe(true);
      expect(response.matches('Hello')).toBe(true);
      expect(response.matches('HELLO')).toBe(true);
    });

    it('should match regex patterns', () => {
      const response = new AutoResponse('hello|hi', 'Greeting!');
      expect(response.matches('hello')).toBe(true);
      expect(response.matches('hi')).toBe(true);
      expect(response.matches('say hello')).toBe(true);
      expect(response.matches('goodbye')).toBe(false);
    });
  });
});
