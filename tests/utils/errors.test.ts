import { describe, it, expect } from 'vitest';
import { parseGraphError, createMcpError } from '../../src/utils/errors.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

describe('parseGraphError', () => {
  it('handles a 429 error with retry-after in innerError (string body)', () => {
    const err = Object.assign(new Error('Too Many Requests'), {
      statusCode: 429,
      body: JSON.stringify({
        error: {
          code: 'TooManyRequests',
          message: 'Rate limit exceeded',
          innerError: { 'retry-after': '30' },
        },
      }),
    });

    const result = parseGraphError(err);
    expect(result).toBe('Graph API rate limit exceeded (429). Retry after 30 seconds.');
  });

  it('handles a 429 error with retry-after in innerError (object body)', () => {
    const err = Object.assign(new Error('Too Many Requests'), {
      statusCode: 429,
      body: {
        error: {
          code: 'TooManyRequests',
          message: 'Rate limit exceeded',
          innerError: { 'retry-after': '60' },
        },
      },
    });

    const result = parseGraphError(err);
    expect(result).toBe('Graph API rate limit exceeded (429). Retry after 60 seconds.');
  });

  it('handles a 429 error with no retry-after (returns unknown)', () => {
    const err = Object.assign(new Error('Too Many Requests'), {
      statusCode: 429,
      body: JSON.stringify({ error: { code: 'TooManyRequests', message: 'Rate limit' } }),
    });

    const result = parseGraphError(err);
    expect(result).toBe('Graph API rate limit exceeded (429). Retry after unknown seconds.');
  });

  it('handles a 404 error with ItemNotFound body as a string', () => {
    const err = Object.assign(new Error('Not Found'), {
      statusCode: 404,
      body: JSON.stringify({
        error: { code: 'ItemNotFound', message: 'Not found' },
      }),
    });

    const result = parseGraphError(err);
    expect(result).toBe('Graph API error [404] ItemNotFound: Not found');
  });

  it('handles a Graph error with numeric statusCode and object body', () => {
    const err = Object.assign(new Error('Forbidden'), {
      statusCode: 403,
      body: {
        error: { code: 'AccessDenied', message: 'Insufficient privileges' },
      },
    });

    const result = parseGraphError(err);
    expect(result).toBe('Graph API error [403] AccessDenied: Insufficient privileges');
  });

  it('handles a plain Error with no statusCode', () => {
    const err = new Error('something failed');
    const result = parseGraphError(err);
    expect(result).toBe('Error: something failed');
  });

  it('handles a non-Error string', () => {
    const result = parseGraphError('plain string error');
    expect(result).toBe('Unexpected error: plain string error');
  });

  it('handles a non-Error object', () => {
    const result = parseGraphError({ code: 42 });
    expect(result).toBe('Unexpected error: [object Object]');
  });
});

describe('createMcpError', () => {
  it('returns an McpError instance with InternalError code', () => {
    const err = createMcpError('something went wrong');
    expect(err).toBeInstanceOf(McpError);
    expect(err.code).toBe(ErrorCode.InternalError);
    expect(err.message).toContain('something went wrong');
  });
});
