import { Webhook } from '../../../src/core/domain/entities/webhook.entity';

describe('Webhook', () => {
  describe('constructor', () => {
    it('should create a Webhook with default values', () => {
      const webhook = new Webhook('test-webhook', 'hello', 'http://example.com');
      expect(webhook.name).toBe('test-webhook');
      expect(webhook.pattern).toBe('hello');
      expect(webhook.url).toBe('http://example.com');
      expect(webhook.method).toBe('POST');
      expect(webhook.headers).toEqual({});
      expect(webhook.timeout).toBe(5000);
      expect(webhook.retry).toBe(3);
      expect(webhook.priority).toBe(1);
    });

    it('should create a Webhook with custom values', () => {
      const webhook = new Webhook(
        'custom-webhook',
        'order.*',
        'http://api.example.com/webhook',
        'PUT',
        { 'Authorization': 'Bearer token' },
        10000,
        5,
        10
      );
      expect(webhook.name).toBe('custom-webhook');
      expect(webhook.pattern).toBe('order.*');
      expect(webhook.url).toBe('http://api.example.com/webhook');
      expect(webhook.method).toBe('PUT');
      expect(webhook.headers).toEqual({ 'Authorization': 'Bearer token' });
      expect(webhook.timeout).toBe(10000);
      expect(webhook.retry).toBe(5);
      expect(webhook.priority).toBe(10);
    });
  });

  describe('matches', () => {
    it('should match pattern case insensitively', () => {
      const webhook = new Webhook('test', 'hello', 'http://example.com');
      expect(webhook.matches('hello')).toBe(true);
      expect(webhook.matches('Hello')).toBe(true);
      expect(webhook.matches('HELLO')).toBe(true);
    });

    it('should match regex patterns', () => {
      const webhook = new Webhook('test', 'order.*', 'http://example.com');
      expect(webhook.matches('order placed')).toBe(true);
      expect(webhook.matches('order cancelled')).toBe(true);
      expect(webhook.matches('hello')).toBe(false);
    });

    it('should be case insensitive by default', () => {
      const webhook = new Webhook('test', 'hello', 'http://example.com');
      expect(webhook.matches('HELLO')).toBe(true);
      expect(webhook.matches('Hello')).toBe(true);
    });
  });
});
