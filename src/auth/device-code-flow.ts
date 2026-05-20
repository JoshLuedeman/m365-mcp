import type { AccountInfo, AuthenticationResult, DeviceCodeRequest } from '@azure/msal-node';
import { getMsalClient } from './msal-client.js';
import { GRAPH_SCOPES } from './scopes.js';

/**
 * Attempts silent token acquisition using cached accounts.
 * Returns null if no cached accounts exist or silent acquisition fails.
 */
async function trySilentAcquire(): Promise<string | null> {
  const client = getMsalClient();
  const accounts = await client.getAllAccounts();

  if (accounts.length === 0) {
    return null;
  }

  // Try each cached account — use the first one that succeeds
  for (const account of accounts) {
    try {
      const result: AuthenticationResult | null = await client.acquireTokenSilent({
        account,
        scopes: GRAPH_SCOPES,
      });
      if (result?.accessToken) {
        return result.accessToken;
      }
    } catch {
      // Silent acquisition failed for this account — try next or fall through to device code
    }
  }

  return null;
}

/**
 * Acquires an access token. Tries silent auth first; falls back to device code flow.
 * Prints device code instructions to stderr (stdout is reserved for MCP JSON-RPC).
 */
export async function acquireToken(): Promise<string> {
  const silentToken = await trySilentAcquire();
  if (silentToken) {
    return silentToken;
  }

  const client = getMsalClient();

  const deviceCodeRequest: DeviceCodeRequest = {
    scopes: GRAPH_SCOPES,
    deviceCodeCallback: (response) => {
      process.stderr.write('\n[m365-mcp] Authentication required\n');
      process.stderr.write(`[m365-mcp] ${response.message}\n\n`);
    },
  };

  const result: AuthenticationResult | null = await client.acquireTokenByDeviceCode(deviceCodeRequest);

  if (!result?.accessToken) {
    throw new Error('Device code authentication did not return an access token.');
  }

  return result.accessToken;
}

/**
 * CLI `auth` subcommand — runs device code flow interactively and reports the signed-in account.
 */
export async function runAuthCommand(): Promise<void> {
  process.stderr.write('[m365-mcp] Starting authentication...\n');

  try {
    const token = await acquireToken();

    if (!token) {
      process.stderr.write('[m365-mcp] Authentication failed — no token returned.\n');
      process.exit(1);
    }

    // Retrieve account info for confirmation message
    const client = getMsalClient();
    const accounts: AccountInfo[] = await client.getAllAccounts();
    const account = accounts[0];

    if (account) {
      process.stderr.write(`[m365-mcp] Authenticated as: ${account.username}\n`);
    } else {
      process.stderr.write('[m365-mcp] Authentication successful.\n');
    }
  } catch (err) {
    process.stderr.write(`[m365-mcp] Authentication error: ${String(err)}\n`);
    process.exit(1);
  }
}
