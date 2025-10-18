import { AutoResponse } from '../../../src/core/domain/value-objects/auto-response.vo';
import { ResponsePattern } from '../../../src/core/domain/value-objects/response-pattern.vo';

describe('AutoResponse Value Object', () => {
  describe('create', () => {
    it('should create a valid AutoResponse', () => {
      const pattern = ResponsePattern.create('hello', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Hi there!',
        priority: 1
      });

      expect(autoResponse.response).toBe('Hi there!');
      expect(autoResponse.priority).toBe(1);
      expect(autoResponse.cooldown).toBeUndefined();
    });

    it('should create AutoResponse with cooldown', () => {
      const pattern = ResponsePattern.create('help', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'How can I help?',
        priority: 2,
        cooldown: 60
      });

      expect(autoResponse.cooldown).toBe(60);
    });

    it('should create AutoResponse with response options', () => {
      const pattern = ResponsePattern.create('test', false);
      const responseOptions = { linkPreview: false };
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Test response',
        priority: 1,
        responseOptions
      });

      expect(autoResponse.responseOptions).toEqual(responseOptions);
    });

    it('should throw error if priority is negative', () => {
      const pattern = ResponsePattern.create('test', false);
      expect(() => {
        AutoResponse.create({
          pattern,
          response: 'Test',
          priority: -1
        });
      }).toThrow('Priority must be non-negative');
    });

    it('should throw error if response is empty', () => {
      const pattern = ResponsePattern.create('test', false);
      expect(() => {
        AutoResponse.create({
          pattern,
          response: '',
          priority: 1
        });
      }).toThrow('Response cannot be empty');
    });

    it('should throw error if response is only whitespace', () => {
      const pattern = ResponsePattern.create('test', false);
      expect(() => {
        AutoResponse.create({
          pattern,
          response: '   ',
          priority: 1
        });
      }).toThrow('Response cannot be empty');
    });
  });

  describe('matches', () => {
    it('should match message against pattern', () => {
      const pattern = ResponsePattern.create('hello', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Hi!',
        priority: 1
      });

      expect(autoResponse.matches('hello')).toBe(true);
      expect(autoResponse.matches('hello world')).toBe(true);
      expect(autoResponse.matches('goodbye')).toBe(false);
    });

    it('should respect case sensitivity', () => {
      const pattern = ResponsePattern.create('Hello', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Hi!',
        priority: 1
      });

      expect(autoResponse.matches('Hello')).toBe(true);
      expect(autoResponse.matches('hello')).toBe(false);
    });

    it('should handle regex patterns', () => {
      const pattern = ResponsePattern.create('\\b(hello|hi|hey)\\b', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Greeting!',
        priority: 1
      });

      expect(autoResponse.matches('hello')).toBe(true);
      expect(autoResponse.matches('hi there')).toBe(true);
      expect(autoResponse.matches('hey you')).toBe(true);
      expect(autoResponse.matches('helloworld')).toBe(false);
    });
  });

  describe('getters', () => {
    it('should return pattern', () => {
      const pattern = ResponsePattern.create('test', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Test response',
        priority: 1
      });

      expect(autoResponse.pattern).toBe(pattern);
    });

    it('should return response', () => {
      const pattern = ResponsePattern.create('test', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Test response',
        priority: 1
      });

      expect(autoResponse.response).toBe('Test response');
    });

    it('should return priority', () => {
      const pattern = ResponsePattern.create('test', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Test response',
        priority: 5
      });

      expect(autoResponse.priority).toBe(5);
    });

    it('should return cooldown', () => {
      const pattern = ResponsePattern.create('test', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Test response',
        priority: 1,
        cooldown: 120
      });

      expect(autoResponse.cooldown).toBe(120);
    });

    it('should return responseOptions', () => {
      const pattern = ResponsePattern.create('test', false);
      const options = { linkPreview: true, sendAudioAsVoice: false };
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Test response',
        priority: 1,
        responseOptions: options
      });

      expect(autoResponse.responseOptions).toEqual(options);
    });
  });

  describe('priority handling', () => {
    it('should allow priority 0', () => {
      const pattern = ResponsePattern.create('test', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Test',
        priority: 0
      });

      expect(autoResponse.priority).toBe(0);
    });

    it('should allow large priority values', () => {
      const pattern = ResponsePattern.create('test', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Test',
        priority: 9999
      });

      expect(autoResponse.priority).toBe(9999);
    });
  });

  describe('cooldown handling', () => {
    it('should allow undefined cooldown', () => {
      const pattern = ResponsePattern.create('test', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Test',
        priority: 1
      });

      expect(autoResponse.cooldown).toBeUndefined();
    });

    it('should allow cooldown 0', () => {
      const pattern = ResponsePattern.create('test', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Test',
        priority: 1,
        cooldown: 0
      });

      expect(autoResponse.cooldown).toBe(0);
    });

    it('should allow large cooldown values', () => {
      const pattern = ResponsePattern.create('test', false);
      const autoResponse = AutoResponse.create({
        pattern,
        response: 'Test',
        priority: 1,
        cooldown: 86400 // 24 hours
      });

      expect(autoResponse.cooldown).toBe(86400);
    });
  });
});
