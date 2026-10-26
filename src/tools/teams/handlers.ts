import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAccessToken } from '../../auth/index.js';
import { getGraphClient, getApiBase } from '../../graph/client.js';
import { formatResponse, formatError } from '../../utils/formatting.js';
import { parseGraphError } from '../../utils/errors.js';

interface TeamGroup {
  id?: string;
  displayName?: string;
  description?: string;
}

interface Channel {
  id?: string;
  displayName?: string;
  description?: string;
  email?: string;
  webUrl?: string;
}

interface ChatMessage {
  id?: string;
  createdDateTime?: string;
  from?: unknown;
  body?: { content?: string; contentType?: string };
}

interface Chat {
  id?: string;
  topic?: string;
  chatType?: string;
  lastUpdatedDateTime?: string;
}

/**
 * Lists Microsoft 365 groups that are Teams-enabled (i.e. the user/app can
 * see which Teams exist). This is the discovery step before listing channels —
 * Graph has no single "list my teams" app-only endpoint, so this goes through
 * the /groups endpoint filtered to Team-provisioned groups, per Microsoft's
 * own documented least-privileged pattern for Application permissions
 * (Group.ReadBasic.All).
 */
export async function handleListJoinedTeams(top?: number): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    let request = client
      .api("/groups")
      .filter("resourceProvisioningOptions/Any(x:x eq 'Team')")
      .select('id,displayName,description');

    if (top !== undefined) {
      request = request.top(top);
    }

    const response = await request.get() as { value?: TeamGroup[] };
    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleListChannels(teamId: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    const response = await client
      .api(`/teams/${teamId}/channels`)
      .get() as { value?: Channel[] };

    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleListChannelMessages(
  teamId: string,
  channelId: string,
  top?: number,
): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);

    let request = client.api(`/teams/${teamId}/channels/${channelId}/messages`);
    if (top !== undefined) {
      request = request.top(top);
    }

    const response = await request.get() as { value?: ChatMessage[] };
    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

/**
 * Lists 1:1 and group chats for a specific mailbox. Unlike team channels
 * (which are organization-wide resources), chats are scoped to a specific
 * user/mailbox, so this routes through the same getApiBase() mailbox guard
 * as every other per-mailbox category.
 */
export async function handleListChats(mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);

    const response = await client
      .api(`${base}/chats`)
      .get() as { value?: Chat[] };

    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleListChatMessages(
  chatId: string,
  top?: number,
  mailbox?: string,
): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);

    let request = client.api(`${base}/chats/${chatId}/messages`);
    if (top !== undefined) {
      request = request.top(top);
    }

    const response = await request.get() as { value?: ChatMessage[] };
    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}
