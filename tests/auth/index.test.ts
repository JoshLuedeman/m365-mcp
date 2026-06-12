import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock both auth flows before importing the unified entry point
// ---------------------------------------------------------------------------
vi.mock('../../src/auth/device-code-flow.js', () => ({
  acquireToken: vi.fn().mockResolvedValue('device-code-token'),
}));

vi.mock('../../src/auth/client-credentials-flow.js', () => ({
  acquireAppToken: vi.fn().mockResolvedValue('client-credentials-token'),
}));

import { acquireToken } from '../../src/auth/device-code-flow.js';
import { acquireAppToken } from '../../src/auth/client-credentials-flow.js';
import { getAccessToken, getAuthMode } from '../../src/auth/index.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getAuthMode', () => {
  afterEach(() => {
    delete process.env['M365_AUTH_MODE'];
  });

  it('returns device_code when M365_AUTH_MODE is not set', () => {
    delete process.env['M365_AUTH_MODE'];
    expect(getAuthMode()).toBe('device_code');
  });

  it('returns client_credentials when M365_AUTH_MODE=client_credentials', () => {
    process.env['M365_AUTH_MODE'] = 'client_credentials';
    expect(getAuthMode()).toBe('client_credentials');
  });

  it('returns device_code for an unknown value', () => {
    process.env['M365_AUTH_MODE'] = 'something_else';
    expect(getAuthMode()).toBe('device_code');
  });

  it('returns device_code when M365_AUTH_MODE=device_code explicitly', () => {
    process.env['M365_AUTH_MODE'] = 'device_code';
    expect(getAuthMode()).toBe('device_code');
  });
});

describe('getAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['M365_AUTH_MODE'];
  });

  afterEach(() => {
    delete process.env['M365_AUTH_MODE'];
  });

  it('calls acquireToken in device_code mode (default)', async () => {
    delete process.env['M365_AUTH_MODE'];

    const token = await getAccessToken();

    expect(token).toBe('device-code-token');
    expect(acquireToken).toHaveBeenCalledOnce();
    expect(acquireAppToken).not.toHaveBeenCalled();
  });

  it('calls acquireToken when M365_AUTH_MODE=device_code', async () => {
    process.env['M365_AUTH_MODE'] = 'device_code';

    const token = await getAccessToken();

    expect(token).toBe('device-code-token');
    expect(acquireToken).toHaveBeenCalledOnce();
    expect(acquireAppToken).not.toHaveBeenCalled();
  });

  it('calls acquireAppToken when M365_AUTH_MODE=client_credentials', async () => {
    process.env['M365_AUTH_MODE'] = 'client_credentials';

    const token = await getAccessToken();

    expect(token).toBe('client-credentials-token');
    expect(acquireAppToken).toHaveBeenCalledOnce();
    expect(acquireToken).not.toHaveBeenCalled();
  });

  it('propagates errors from acquireToken', async () => {
    vi.mocked(acquireToken).mockRejectedValueOnce(new Error('Device auth failed'));

    await expect(getAccessToken()).rejects.toThrow('Device auth failed');
  });

  it('propagates errors from acquireAppToken in client_credentials mode', async () => {
    process.env['M365_AUTH_MODE'] = 'client_credentials';
    vi.mocked(acquireAppToken).mockRejectedValueOnce(new Error('App token failed'));

    await expect(getAccessToken()).rejects.toThrow('App token failed');
  });
});
