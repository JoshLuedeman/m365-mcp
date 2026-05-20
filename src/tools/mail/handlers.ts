import type { Message, MailFolder, Recipient } from '@microsoft/microsoft-graph-types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { acquireToken } from '../../auth/device-code-flow.js';
import { getGraphClient } from '../../graph/client.js';
import { collectAllPages } from '../../utils/pagination.js';
import { formatResponse, formatError } from '../../utils/formatting.js';
import { parseGraphError } from '../../utils/errors.js';

interface SearchEmailsParams {
  query?: string;
  from?: string;
  startDate?: string;
  endDate?: string;
  folder?: string;
  top?: number;
}

export async function handleSearchEmails(params: SearchEmailsParams): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);

    const folderSegment = params.folder !== undefined ? `/me/mailFolders/${params.folder}/messages` : '/me/messages';
    let request = client.api(folderSegment);

    if (params.query !== undefined) {
      request = request.search(`"${params.query}"`);
    }

    const filters: string[] = [];
    if (params.from !== undefined) {
      filters.push(`from/emailAddress/address eq '${params.from}'`);
    }
    if (params.startDate !== undefined) {
      filters.push(`receivedDateTime ge ${params.startDate}T00:00:00Z`);
    }
    if (params.endDate !== undefined) {
      filters.push(`receivedDateTime le ${params.endDate}T23:59:59Z`);
    }
    if (filters.length > 0) {
      request = request.filter(filters.join(' and '));
    }

    if (params.top !== undefined) {
      request = request.top(params.top);
    }

    request = request.select('id,subject,from,receivedDateTime,bodyPreview,isRead,flag,hasAttachments');

    const response = await request.get() as { value?: Message[] };
    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleReadEmail(messageId: string): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);
    const message = await client
      .api(`/me/messages/${messageId}`)
      .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,isRead,flag,hasAttachments')
      .get() as Message;
    return formatResponse(message);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface SendEmailParams {
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  contentType?: 'text' | 'html';
}

function toRecipients(emails: string[]): Recipient[] {
  return emails.map((address) => ({ emailAddress: { address } }));
}

export async function handleSendEmail(params: SendEmailParams): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);

    const contentType = params.contentType ?? 'text';

    const message = {
      message: {
        subject: params.subject,
        body: { contentType, content: params.body },
        toRecipients: toRecipients(params.to),
        ...(params.cc !== undefined && { ccRecipients: toRecipients(params.cc) }),
        ...(params.bcc !== undefined && { bccRecipients: toRecipients(params.bcc) }),
      },
    };

    await client.api('/me/sendMail').post(message);
    return formatResponse({ sent: true, subject: params.subject });
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleFlagEmail(
  messageId: string,
  flagStatus: 'flagged' | 'complete' | 'notFlagged',
): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);
    const updated = await client
      .api(`/me/messages/${messageId}`)
      .patch({ flag: { flagStatus } }) as Message;
    return formatResponse(updated);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleListMailFolders(): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);
    const folders = await collectAllPages<MailFolder>(client, '/me/mailFolders');
    return formatResponse(folders);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleMoveEmail(
  messageId: string,
  destinationFolderId: string,
): Promise<CallToolResult> {
  try {
    const token = await acquireToken();
    const client = getGraphClient(token);
    const moved = await client
      .api(`/me/messages/${messageId}/move`)
      .post({ destinationId: destinationFolderId }) as Message;
    return formatResponse(moved);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}
