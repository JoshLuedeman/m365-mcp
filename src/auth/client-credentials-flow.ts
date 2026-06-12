import { ConfidentialClientApplication } from '@azure/msal-node';
import type { Configuration, ClientCredentialRequest, AuthenticationResult } from '@azure/msal-node';

// Simple in-memory token cache to avoid unnecessary round-trips
interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let _confidentialClient: ConfidentialClientApplication | undefined;
let _cachedToken: CachedToken | undefined;

// Token expiry buffer: refresh 2 minutes before actual expiry
const EXPIRY_BUFFER_MS = 2 * 60 * 1000;

function loadClientCredentialConfig(): { clientId: string; clientSecret: string; tenantId: string } {
  // Support both M365_CLIENT_ID and M365_MCP_CLIENT_ID for consistency with existing naming
  const clientId =
    process.env['M365_CLIENT_ID'] ??
    process.env['M365_MCP_CLIENT_ID'];

  if (!clientId) {
    throw new Error(
      '[m365-mcp] client_credentials auth requires M365_CLIENT_ID (or M365_MCP_CLIENT_ID) to be set.',
    );
  }

  const clientSecret = process.env['M365_CLIENT_SECRET'];
  if (!clientSecret) {
    throw new Error(
      '[m365-mcp] client_credentials auth requires M365_CLIENT_SECRET to be set.',
    );
  }

  // Support both M365_TENANT_ID and M365_MCP_TENANT_ID for consistency with existing naming
  const tenantId =
    process.env['M365_TENANT_ID'] ??
    process.env['M365_MCP_TENANT_ID'];

  if (!tenantId) {
    throw new Error(
      '[m365-mcp] client_credentials auth requires M365_TENANT_ID (or M365_MCP_TENANT_ID) to be set.',
    );
  }

  return { clientId, clientSecret, tenantId };
}

/**
 * Returns the MSAL ConfidentialClientApplication, creating it on first call.
 * Config is read from env vars each time to support runtime changes in tests.
 */
export function getConfidentialClient(): ConfidentialClientApplication {
  if (_confidentialClient) {
    return _confidentialClient;
  }

  const { clientId, clientSecret, tenantId } = loadClientCredentialConfig();

  const msalConfig: Configuration = {
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
    system: {
      loggerOptions: {
        loggerCallback: (_level, message, containsPii) => {
          if (!containsPii) {
            process.stderr.write(`[msal-cc] ${message}\n`);
          }
        },
        piiLoggingEnabled: false,
      },
    },
  };

  _confidentialClient = new ConfidentialClientApplication(msalConfig);
  return _confidentialClient;
}

/**
 * Acquires an app-only access token using the client credentials flow.
 * Uses a simple in-memory cache with a 2-minute expiry buffer.
 * Reads config from env vars: M365_CLIENT_ID, M365_CLIENT_SECRET, M365_TENANT_ID
 * (also accepts M365_MCP_CLIENT_ID and M365_MCP_TENANT_ID for compatibility).
 */
export async function acquireAppToken(): Promise<string> {
  // Return cached token if still valid
  const now = Date.now();
  if (_cachedToken !== undefined && _cachedToken.expiresAt > now) {
    return _cachedToken.accessToken;
  }

  const client = getConfidentialClient();

  const request: ClientCredentialRequest = {
    // Graph app-only scope — .default expands to all Application permissions granted in the portal
    scopes: ['https://graph.microsoft.com/.default'],
  };

  const result: AuthenticationResult | null = await client.acquireTokenByClientCredential(request);

  if (!result?.accessToken) {
    throw new Error('[m365-mcp] client_credentials flow did not return an access token.');
  }

  // Cache the token; use MSAL-provided expiry or default to 55 minutes
  const expiresInMs = result.expiresOn
    ? result.expiresOn.getTime() - now - EXPIRY_BUFFER_MS
    : 55 * 60 * 1000;

  _cachedToken = {
    accessToken: result.accessToken,
    expiresAt: now + Math.max(expiresInMs, 0),
  };

  return result.accessToken;
}

/**
 * Clears the in-memory token cache and the MSAL client singleton.
 * Useful for testing or forced re-authentication.
 */
export function resetClientCredentialState(): void {
  _confidentialClient = undefined;
  _cachedToken = undefined;
}
