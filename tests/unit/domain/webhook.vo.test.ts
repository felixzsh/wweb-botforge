import { Webhook } from '../../../src/core/domain/value-objects/webhook.vo';
import { ResponsePattern } from '../../../src/core/domain/value-objects/response-pattern.vo';

describe('Webhook Value Object', () => {
  describe('create', () => {
    it('should create a valid webhook with required fields', () => {
      const pattern = ResponsePattern.create('test');
      const webhook = Webhook.create({
        name: 'test-webhook',
        pattern,
        url: 'https://example.com/webhook',
        method: 'POST'
      });

      expect(webhook.name).toBe('test-webhook');
      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.method).toBe('POST');
    });

    it('should create webhook with all optional fields', () => {
      const pattern = ResponsePattern.create('test');
      const headers = { 'Authorization': 'Bearer token' };
      const webhook = Webhook.create({
        name: 'full-webhook',
        pattern,
        url: 'https://api.example.com/hook',
        method: 'PUT',
        headers,
        timeout: 10000,
        retries: 5,
        priority: 2,
        cooldown: 60
      });

      expect(webhook.name).toBe('full-webhook');
      expect(webhook.headers).toEqual(headers);
      expect(webhook.timeout).toBe(10000);
      expect(webhook.retries).toBe(5);
      expect(webhook.priority).toBe(2);
      expect(webhook.cooldown).toBe(60);
    });

    it('should throw error when name is empty', () => {
      const pattern = ResponsePattern.create('test');
      expect(() => {
        Webhook.create({
          name: '',
          pattern,
          url: 'https://example.com',
          method: 'POST'
        });
      }).toThrow('Webhook name cannot be empty');
    });

    it('should throw error when name is whitespace only', () => {
      const pattern = ResponsePattern.create('test');
      expect(() => {
        Webhook.create({
          name: '   ',
          pattern,
          url: 'https://example.com',
          method: 'POST'
        });
      }).toThrow('Webhook name cannot be empty');
    });

    it('should throw error when URL is empty', () => {
      const pattern = ResponsePattern.create('test');
      expect(() => {
        Webhook.create({
          name: 'test',
          pattern,
          url: '',
          method: 'POST'
        });
      }).toThrow('Webhook URL cannot be empty');
    });

    it('should throw error when URL is whitespace only', () => {
      const pattern = ResponsePattern.create('test');
      expect(() => {
        Webhook.create({
          name: 'test',
          pattern,
          url: '   ',
          method: 'POST'
        });
      }).toThrow('Webhook URL cannot be empty');
    });

    it('should throw error when priority is negative', () => {
      const pattern = ResponsePattern.create('test');
      expect(() => {
        Webhook.create({
          name: 'test',
          pattern,
          url: 'https://example.com',
          method: 'POST',
          priority: -1
        });
      }).toThrow('Priority must be non-negative');
    });
  });

  describe('matches', () => {
    it('should match text against pattern', () => {
      const pattern = ResponsePattern.create('hello|hi');
      const webhook = Webhook.create({
        name: 'greeting',
        pattern,
        url: 'https://example.com',
        method: 'POST'
      });

      expect(webhook.matches('hello world')).toBe(true);
      expect(webhook.matches('hi there')).toBe(true);
      expect(webhook.matches('goodbye')).toBe(false);
    });

    it('should respect case sensitivity in pattern', () => {
      const pattern = ResponsePattern.create('HELLO', false);
      const webhook = Webhook.create({
        name: 'test',
        pattern,
        url: 'https://example.com',
        method: 'POST'
      });

      expect(webhook.matches('HELLO')).toBe(true);
      expect(webhook.matches('hello')).toBe(false);
    });

    it('should respect case insensitivity when enabled', () => {
      const pattern = ResponsePattern.create('hello', true);
      const webhook = Webhook.create({
        name: 'test',
        pattern,
        url: 'https://example.com',
        method: 'POST'
      });

      expect(webhook.matches('hello')).toBe(true);
      expect(webhook.matches('HELLO')).toBe(true);
      expect(webhook.matches('Hello')).toBe(true);
    });
  });

  describe('default values', () => {
    it('should use default timeout when not provided', () => {
      const pattern = ResponsePattern.create('test');
      const webhook = Webhook.create({
        name: 'test',
        pattern,
        url: 'https://example.com',
        method: 'POST'
      });

      expect(webhook.timeout).toBe(5000);
    });

    it('should use default retries when not provided', () => {
      const pattern = ResponsePattern.create('test');
      const webhook = Webhook.create({
        name: 'test',
        pattern,
        url: 'https://example.com',
        method: 'POST'
      });

      expect(webhook.retries).toBe(3);
    });

    it('should use default priority when not provided', () => {
      const pattern = ResponsePattern.create('test');
      const webhook = Webhook.create({
        name: 'test',
        pattern,
        url: 'https://example.com',
        method: 'POST'
      });

      expect(webhook.priority).toBe(1);
    });

    it('should return empty headers object when not provided', () => {
      const pattern = ResponsePattern.create('test');
      const webhook = Webhook.create({
        name: 'test',
        pattern,
        url: 'https://example.com',
        method: 'POST'
      });

      expect(webhook.headers).toEqual({});
    });

    it('should return undefined cooldown when not provided', () => {
      const pattern = ResponsePattern.create('test');
      const webhook = Webhook.create({
        name: 'test',
        pattern,
        url: 'https://example.com',
        method: 'POST'
      });

      expect(webhook.cooldown).toBeUndefined();
    });
  });

  describe('HTTP methods', () => {
    const pattern = ResponsePattern.create('test');

    it('should support GET method', () => {
      const webhook = Webhook.create({
        name: 'test',
        pattern,
        url: 'https://example.com',
        method: 'GET'
      });
      expect(webhook.method).toBe('GET');
    });

    it('should support POST method', () => {
      const webhook = Webhook.create({
        name: 'test',
        pattern,
        url: 'https://example.com',
        method: 'POST'
      });
      expect(webhook.method).toBe('POST');
    });

    it('should support PUT method', () => {
      const webhook = Webhook.create({
        name: 'test',
        pattern,
        url: 'https://example.com',
        method: 'PUT'
      });
      expect(webhook.method).toBe('PUT');
    });

    it('should support PATCH method', () => {
      const webhook = Webhook.create({
        name: 'test',
        pattern,
        url: 'https://example.com',
        method: 'PATCH'
      });
      expect(webhook.method).toBe('PATCH');
    });
  });

  describe('getters', () => {
    it('should provide access to all properties via getters', () => {
      const pattern = ResponsePattern.create('test');
      const headers = { 'X-Custom': 'value' };
      const webhook = Webhook.create({
        name: 'complete-webhook',
        pattern,
        url: 'https://example.com/api',
        method: 'POST',
        headers,
        timeout: 8000,
        retries: 4,
        priority: 3,
        cooldown: 120
      });

      expect(webhook.name).toBe('complete-webhook');
      expect(webhook.pattern).toBe(pattern);
      expect(webhook.url).toBe('https://example.com/api');
      expect(webhook.method).toBe('POST');
      expect(webhook.headers).toEqual(headers);
      expect(webhook.timeout).toBe(8000);
      expect(webhook.retries).toBe(4);
      expect(webhook.priority).toBe(3);
      expect(webhook.cooldown).toBe(120);
    });
  });
});
