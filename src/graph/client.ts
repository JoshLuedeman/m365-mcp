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
 * When the M365_ALLOWED_MAILBOX environment variable is set, this process is
 * hard-restricted to that single mailbox: any caller-supplied `mailbox` value
 * that does not exactly match it is rejected, and every call (even one that
 * omits `mailbox` entirely) is routed to the allowed mailbox instead of `/me`.
 * This is the sole enforcement point for per-process mailbox scoping across
 * every tool category (Mail, Calendar, Tasks, Contacts, and any future
 * category that resolves its mailbox through this function) — do not
 * duplicate this check elsewhere; route every new category through
 * getApiBase() instead.
 *
 * Append resource segments directly: `${getApiBase(mailbox)}/messages`
 */
export function getApiBase(mailbox?: string): string {
  const allowed = process.env['M365_ALLOWED_MAILBOX'];
  const requested = mailbox?.trim();

  if (allowed !== undefined && allowed.trim() !== '') {
    const allowedTrimmed = allowed.trim();
    if (requested !== undefined && requested !== '' && requested !== allowedTrimmed) {
      throw new Error(
        `[m365-mcp] mailbox override rejected: this process is restricted to ${allowedTrimmed}`,
      );
    }
    return `/users/${allowedTrimmed}`;
  }

  if (requested !== undefined && requested !== '') {
    return `/users/${requested}`;
  }
  return '/me';
}
