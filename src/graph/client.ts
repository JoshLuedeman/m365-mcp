import { Client } from '@microsoft/microsoft-graph-client';
import type { AuthenticationProvider } from '@microsoft/microsoft-graph-client';

/**
 * Creates an authenticated Microsoft Graph client using the provided access token.
 * The token is injected via a custom AuthenticationProvider — no MSAL coupling here.
 */
export function getGraphClient(accessToken: string): Client {
  const authProvider: AuthenticationProvider = {
    getAccessToken: async (): Promise<string> => accessToken,
  };

  return Client.initWithMiddleware({ authProvider });
}

/**
 * Returns the Graph API base path for a given mailbox.
 *
 * - No mailbox: returns '/me' (device code / delegated, single signed-in user)
 * - With mailbox: returns '/users/{mailbox}' (app-only / client credentials, multi-mailbox)
 *
 * Append resource segments directly: `${getApiBase(mailbox)}/messages`
 */
export function getApiBase(mailbox?: string): string {
  if (mailbox !== undefined && mailbox.trim() !== '') {
    return `/users/${mailbox.trim()}`;
  }
  return '/me';
}
