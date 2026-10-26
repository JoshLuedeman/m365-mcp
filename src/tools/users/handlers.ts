import type { User } from '@microsoft/microsoft-graph-types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAccessToken } from '../../auth/index.js';
import { getGraphClient } from '../../graph/client.js';
import { formatResponse, formatError } from '../../utils/formatting.js';
import { parseGraphError } from '../../utils/errors.js';

// NOTE: Unlike every other category in this server, Users tools do NOT route
// through getApiBase()/the per-process mailbox guard. Listing/searching the
// tenant's user directory is not a per-mailbox operation — it inherently
// enumerates across the whole org. This means ANY of the 3 mailbox-scoped
// processes (m365-helios-openclaw, m365-helios, m365-josh) can list/search
// every user in the tenant, regardless of which single mailbox that process
// is otherwise restricted to. This is a known, accepted scope gap (per Josh's
// explicit decision to keep Users in scope anyway) — not an oversight. Do not
// add a mailbox-style restriction here without a real per-process allowlist
// design, since none exists today.

const USER_SELECT_FIELDS = 'id,displayName,userPrincipalName,mail,jobTitle,department';

export async function handleListUsers(top?: number): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    let request = client.api('/users').select(USER_SELECT_FIELDS);
    if (top !== undefined) {
      request = request.top(top);
    }

    const response = await request.get() as { value?: User[] };
    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleSearchUsers(query: string, top?: number): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    let request = client
      .api('/users')
      .filter(
        `startsWith(displayName,'${query}') or startsWith(mail,'${query}') or startsWith(userPrincipalName,'${query}')`,
      )
      .select(USER_SELECT_FIELDS);

    if (top !== undefined) {
      request = request.top(top);
    }

    const response = await request.get() as { value?: User[] };
    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleGetUser(userId: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    const user = await client
      .api(`/users/${userId}`)
      .select(USER_SELECT_FIELDS)
      .get() as User;

    return formatResponse(user);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}
