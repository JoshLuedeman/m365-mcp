import { acquireToken } from './device-code-flow.js';
import { acquireAppToken } from './client-credentials-flow.js';

/**
 * Supported auth modes:
 * - 'device_code': delegated auth for a signed-in user (default)
 * - 'client_credentials': app-only auth for server/agent use cases
 */
export type AuthMode = 'client_credentials' | 'device_code';

/**
 * Returns the current auth mode from the M365_AUTH_MODE env var.
 * Defaults to 'device_code' for backward compatibility.
 */
export function getAuthMode(): AuthMode {
  const mode = process.env['M365_AUTH_MODE'];
  if (mode === 'client_credentials') {
    return 'client_credentials';
  }
  return 'device_code';
}

/**
 * Acquires an access token using the configured auth mode.
 *
 * Auth mode is controlled by the M365_AUTH_MODE environment variable:
 * - 'client_credentials': uses acquireAppToken() — requires M365_CLIENT_ID, M365_CLIENT_SECRET, M365_TENANT_ID
 * - 'device_code' (default): uses acquireToken() — interactive device code flow
 */
export async function getAccessToken(): Promise<string> {
  const mode = getAuthMode();

  if (mode === 'client_credentials') {
    return acquireAppToken();
  }

  return acquireToken();
}
