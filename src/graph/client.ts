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
