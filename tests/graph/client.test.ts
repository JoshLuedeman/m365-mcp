import { describe, it, expect, afterEach } from 'vitest';
import { getApiBase } from '../../src/graph/client.js';

describe('getApiBase', () => {
  const ORIGINAL_ENV = process.env['M365_ALLOWED_MAILBOX'];

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env['M365_ALLOWED_MAILBOX'];
    } else {
      process.env['M365_ALLOWED_MAILBOX'] = ORIGINAL_ENV;
    }
  });

  describe('without M365_ALLOWED_MAILBOX set (unrestricted process)', () => {
    it('returns /me when no mailbox is given', () => {
      delete process.env['M365_ALLOWED_MAILBOX'];
      expect(getApiBase()).toBe('/me');
      expect(getApiBase(undefined)).toBe('/me');
      expect(getApiBase('')).toBe('/me');
    });

    it('returns /users/{mailbox} when a mailbox is given', () => {
      delete process.env['M365_ALLOWED_MAILBOX'];
      expect(getApiBase('someone@example.com')).toBe('/users/someone@example.com');
    });
  });

  describe('with M365_ALLOWED_MAILBOX set (restricted process)', () => {
    it('routes to the allowed mailbox when no mailbox param is given', () => {
      process.env['M365_ALLOWED_MAILBOX'] = 'helios-openclaw@joshluedeman.com';
      expect(getApiBase()).toBe('/users/helios-openclaw@joshluedeman.com');
      expect(getApiBase(undefined)).toBe('/users/helios-openclaw@joshluedeman.com');
    });

    it('succeeds when the requested mailbox matches the allowed mailbox', () => {
      process.env['M365_ALLOWED_MAILBOX'] = 'helios-openclaw@joshluedeman.com';
      expect(getApiBase('helios-openclaw@joshluedeman.com')).toBe(
        '/users/helios-openclaw@joshluedeman.com',
      );
    });

    it('throws when the requested mailbox does NOT match the allowed mailbox', () => {
      process.env['M365_ALLOWED_MAILBOX'] = 'helios-openclaw@joshluedeman.com';
      expect(() => getApiBase('josh@joshluedeman.com')).toThrow(
        /mailbox override rejected/,
      );
      expect(() => getApiBase('helios@joshluedeman.com')).toThrow(
        /mailbox override rejected/,
      );
    });

    it('throws for a cross-mailbox attempt even with surrounding whitespace', () => {
      process.env['M365_ALLOWED_MAILBOX'] = ' helios-openclaw@joshluedeman.com ';
      expect(getApiBase()).toBe('/users/helios-openclaw@joshluedeman.com');
      expect(() => getApiBase(' josh@joshluedeman.com ')).toThrow(
        /mailbox override rejected/,
      );
    });

    it('treats an empty-string mailbox override as no override (falls back to allowed)', () => {
      process.env['M365_ALLOWED_MAILBOX'] = 'helios-openclaw@joshluedeman.com';
      expect(getApiBase('')).toBe('/users/helios-openclaw@joshluedeman.com');
    });
  });
});
