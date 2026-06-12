import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// We need to reset module state between tests because client-credentials-flow
// uses module-level singletons (_confidentialClient, _cachedToken).
// ---------------------------------------------------------------------------
vi.mock('@azure/msal-node', () => {
  const mockAcquireTokenByClientCredential = vi.fn();

  const MockConfidentialClientApplication = vi.fn().mockImplementation(() => ({
    acquireTokenByClientCredential: mockAcquireTokenByClientCredential,
  }));

  return {
    ConfidentialClientApplication: MockConfidentialClientApplication,
    __mockAcquireToken: mockAcquireTokenByClientCredential,
  };
});

import * as msalNode from '@azure/msal-node';
import { acquireAppToken, resetClientCredentialState } from '../../src/auth/client-credentials-flow.js';

// Access the mock via the module export
const mockAcquireToken = (msalNode as unknown as { __mockAcquireToken: ReturnType<typeof vi.fn> }).__mockAcquireToken;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, val] of Object.entries(vars)) {
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }
}

const VALID_ENV = {
  M365_CLIENT_ID: 'test-client-id',
  M365_CLIENT_SECRET: 'test-client-secret',
  M365_TENANT_ID: 'test-tenant-id',
};

function makeMsalResult(accessToken: string, expiresInMs = 3600 * 1000) {
  return {
    accessToken,
    expiresOn: new Date(Date.now() + expiresInMs),
    tokenType: 'Bearer',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('acquireAppToken', () => {
  beforeEach(() => {
    setEnv(VALID_ENV);
    resetClientCredentialState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    setEnv({
      M365_CLIENT_ID: undefined,
      M365_CLIENT_SECRET: undefined,
      M365_TENANT_ID: undefined,
      M365_MCP_CLIENT_ID: undefined,
      M365_MCP_TENANT_ID: undefined,
    });
    resetClientCredentialState();
  });

  it('returns an access token on success', async () => {
    mockAcquireToken.mockResolvedValueOnce(makeMsalResult('access-token-1'));

    const token = await acquireAppToken();

    expect(token).toBe('access-token-1');
    expect(mockAcquireToken).toHaveBeenCalledOnce();
  });

  it('calls acquireTokenByClientCredential with graph .default scope', async () => {
    mockAcquireToken.mockResolvedValueOnce(makeMsalResult('access-token-2'));

    await acquireAppToken();

    expect(mockAcquireToken).toHaveBeenCalledWith({
      scopes: ['https://graph.microsoft.com/.default'],
    });
  });

  it('returns cached token on second call without calling MSAL again', async () => {
    mockAcquireToken.mockResolvedValueOnce(makeMsalResult('cached-token', 3600 * 1000));

    const token1 = await acquireAppToken();
    const token2 = await acquireAppToken();

    expect(token1).toBe('cached-token');
    expect(token2).toBe('cached-token');
    expect(mockAcquireToken).toHaveBeenCalledOnce(); // Only one MSAL call
  });

  it('fetches a new token when cache is expired', async () => {
    // First call: token expires immediately (0ms)
    mockAcquireToken.mockResolvedValueOnce(makeMsalResult('old-token', 0));
    // Second call: fresh token
    mockAcquireToken.mockResolvedValueOnce(makeMsalResult('new-token', 3600 * 1000));

    await acquireAppToken();
    resetClientCredentialState();
    // Re-set env after reset
    setEnv(VALID_ENV);

    const newToken = await acquireAppToken();
    expect(newToken).toBe('new-token');
  });

  it('throws when MSAL returns null', async () => {
    mockAcquireToken.mockResolvedValueOnce(null);

    await expect(acquireAppToken()).rejects.toThrow('did not return an access token');
  });

  it('throws when M365_CLIENT_ID is missing', async () => {
    setEnv({ M365_CLIENT_ID: undefined, M365_MCP_CLIENT_ID: undefined });

    await expect(acquireAppToken()).rejects.toThrow('M365_CLIENT_ID');
  });

  it('throws when M365_CLIENT_SECRET is missing', async () => {
    setEnv({ M365_CLIENT_SECRET: undefined });

    await expect(acquireAppToken()).rejects.toThrow('M365_CLIENT_SECRET');
  });

  it('throws when M365_TENANT_ID is missing', async () => {
    setEnv({ M365_TENANT_ID: undefined, M365_MCP_TENANT_ID: undefined });

    await expect(acquireAppToken()).rejects.toThrow('M365_TENANT_ID');
  });

  it('accepts M365_MCP_CLIENT_ID as an alternative to M365_CLIENT_ID', async () => {
    setEnv({ M365_CLIENT_ID: undefined, M365_MCP_CLIENT_ID: 'alt-client-id' });
    mockAcquireToken.mockResolvedValueOnce(makeMsalResult('alt-token'));

    const token = await acquireAppToken();
    expect(token).toBe('alt-token');
  });

  it('accepts M365_MCP_TENANT_ID as an alternative to M365_TENANT_ID', async () => {
    setEnv({ M365_TENANT_ID: undefined, M365_MCP_TENANT_ID: 'alt-tenant-id' });
    mockAcquireToken.mockResolvedValueOnce(makeMsalResult('alt-token-2'));

    const token = await acquireAppToken();
    expect(token).toBe('alt-token-2');
  });

  it('passes MSAL errors through', async () => {
    mockAcquireToken.mockRejectedValueOnce(new Error('AADSTS70011: Invalid scope'));

    await expect(acquireAppToken()).rejects.toThrow('AADSTS70011');
  });
});
