import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import { writeConfig, readConfig } from '../../src/setup/config-writer.js';

describe('writeConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates the config directory, writes the file with mode 0o600, and chmods it', () => {
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);
    const chmodSpy = vi.spyOn(fs, 'chmodSync').mockReturnValue(undefined);

    writeConfig({ clientId: 'test-client-id', tenantId: 'test-tenant' });

    expect(mkdirSpy).toHaveBeenCalledOnce();
    expect(writeSpy).toHaveBeenCalledOnce();
    expect(chmodSpy).toHaveBeenCalledOnce();

    const [, content, options] = writeSpy.mock.calls[0] as [string, string, { mode: number }];
    const parsed = JSON.parse(content) as { clientId: string; tenantId: string };
    expect(parsed.clientId).toBe('test-client-id');
    expect(parsed.tenantId).toBe('test-tenant');
    expect(options.mode).toBe(0o600);
  });

  it('writes only clientId when tenantId is omitted', () => {
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'chmodSync').mockReturnValue(undefined);

    writeConfig({ clientId: 'only-client' });

    const [, content] = writeSpy.mock.calls[0] as [string, string];
    const parsed = JSON.parse(content) as { clientId: string; tenantId?: string };
    expect(parsed.clientId).toBe('only-client');
    expect(parsed.tenantId).toBeUndefined();
  });
});

describe('readConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the config when the file exists and has a clientId', () => {
    const config = { clientId: 'abc-123', tenantId: 'my-tenant' };
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(config));

    const result = readConfig();
    expect(result).toEqual(config);
  });

  it('returns null when the file does not exist', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = readConfig();
    expect(result).toBeNull();
  });

  it('returns null when the file has no clientId', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ tenantId: 'only-tenant' }));

    const result = readConfig();
    expect(result).toBeNull();
  });

  it('returns null when the file contains invalid JSON', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{ not valid json }');

    const result = readConfig();
    expect(result).toBeNull();
  });
});
