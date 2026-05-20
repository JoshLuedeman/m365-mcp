import { describe, it, expect } from 'vitest';
import { formatResponse, formatError } from '../../src/utils/formatting.js';

describe('formatResponse', () => {
  it('returns a single text content block for a simple object', () => {
    const data = { id: '1', name: 'Test' };
    const result = formatResponse(data);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    const parsed: unknown = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed).toEqual(data);
  });

  it('serializes an array', () => {
    const data = [{ id: '1' }, { id: '2' }];
    const result = formatResponse(data);

    expect(result.content[0].type).toBe('text');
    const parsed: unknown = JSON.parse((result.content[0] as { type: string; text: string }).text);
    expect(parsed).toEqual(data);
  });

  it('serializes null', () => {
    const result = formatResponse(null);

    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as { type: string; text: string }).text).toBe('null');
  });

  it('does not set isError', () => {
    const result = formatResponse({ ok: true });
    expect(result.isError).toBeUndefined();
  });
});

describe('formatError', () => {
  it('sets isError: true', () => {
    const result = formatError('something went wrong');
    expect(result.isError).toBe(true);
  });

  it('includes the message in content text', () => {
    const message = 'Graph API error [404] ItemNotFound: Not found';
    const result = formatError(message);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect((result.content[0] as { type: string; text: string }).text).toBe(message);
  });

  it('produces a single content block', () => {
    const result = formatError('fail');
    expect(result.content).toHaveLength(1);
  });
});
