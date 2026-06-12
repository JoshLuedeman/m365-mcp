import type { Message, MailFolder, Recipient } from '@microsoft/microsoft-graph-types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAccessToken } from '../../auth/index.js';
import { getGraphClient, getApiBase } from '../../graph/client.js';
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
  mailbox?: string;
}

export async function handleSearchEmails(params: SearchEmailsParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

    const folderSegment =
      params.folder !== undefined
        ? `${base}/mailFolders/${params.folder}/messages`
        : `${base}/messages`;

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

export async function handleReadEmail(messageId: string, mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);
    const message = await client
      .api(`${base}/messages/${messageId}`)
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
  mailbox?: string;
}

function toRecipients(emails: string[]): Recipient[] {
  return emails.map((address) => ({ emailAddress: { address } }));
}

export async function handleSendEmail(params: SendEmailParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

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

    await client.api(`${base}/sendMail`).post(message);
    return formatResponse({ sent: true, subject: params.subject });
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleFlagEmail(
  messageId: string,
  flagStatus: 'flagged' | 'complete' | 'notFlagged',
  mailbox?: string,
): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);
    const updated = await client
      .api(`${base}/messages/${messageId}`)
      .patch({ flag: { flagStatus } }) as Message;
    return formatResponse(updated);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleListMailFolders(mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);
    const folders = await collectAllPages<MailFolder>(client, `${base}/mailFolders`);
    return formatResponse(folders);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleMoveEmail(
  messageId: string,
  destinationFolderId: string,
  mailbox?: string,
): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);
    const moved = await client
      .api(`${base}/messages/${messageId}/move`)
      .post({ destinationId: destinationFolderId }) as Message;
    return formatResponse(moved);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

// ---------------------------------------------------------------------------
// NEW TOOLS
// ---------------------------------------------------------------------------

interface ReplyEmailParams {
  messageId: string;
  body: string;
  contentType?: 'text' | 'html';
  replyAll?: boolean;
  mailbox?: string;
}

/**
 * Replies to an email message. Uses Graph reply/replyAll endpoints.
 * The `comment` field is used for plain-text inline replies.
 * For rich-body replies, `message.body` can be set alongside the comment.
 */
export async function handleReplyEmail(params: ReplyEmailParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

    const action = params.replyAll === true ? 'replyAll' : 'reply';
    const contentType = params.contentType ?? 'text';

    // Graph supports `comment` for simple text replies.
    // For html or structured body, embed in the message object.
    const payload =
      contentType === 'text'
        ? { comment: params.body }
        : {
            comment: '',
            message: {
              body: { contentType, content: params.body },
            },
          };

    await client.api(`${base}/messages/${params.messageId}/${action}`).post(payload);

    return formatResponse({ replied: true, messageId: params.messageId, replyAll: params.replyAll ?? false });
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface DeleteEmailParams {
  messageId: string;
  permanent?: boolean;
  mailbox?: string;
}

/**
 * Deletes an email message.
 * - permanent=false (default): moves to Deleted Items folder (recoverable)
 * - permanent=true: hard-deletes via DELETE (unrecoverable)
 */
export async function handleDeleteEmail(params: DeleteEmailParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

    if (params.permanent === true) {
      await client.api(`${base}/messages/${params.messageId}`).delete();
      return formatResponse({ deleted: true, permanent: true, messageId: params.messageId });
    }

    // Soft delete: move to Deleted Items. 'deleteditems' is a well-known folder name.
    const moved = await client
      .api(`${base}/messages/${params.messageId}/move`)
      .post({ destinationId: 'deleteditems' }) as Message;

    return formatResponse({ deleted: true, permanent: false, messageId: params.messageId, movedTo: 'deleteditems', message: moved });
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface MarkReadParams {
  messageId: string;
  isRead?: boolean;
  mailbox?: string;
}

/**
 * Marks an email message as read or unread.
 */
export async function handleMarkRead(params: MarkReadParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

    const isRead = params.isRead ?? true;

    const updated = await client
      .api(`${base}/messages/${params.messageId}`)
      .patch({ isRead }) as Message;

    return formatResponse(updated);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface EnsureFolderParams {
  displayName: string;
  mailbox?: string;
}

/**
 * Gets an existing mail folder by display name, or creates it if it doesn't exist.
 * Returns the folder ID and whether it was newly created.
 */
export async function handleEnsureFolder(params: EnsureFolderParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

    // Fetch all folders and look for a case-insensitive name match
    const folders = await collectAllPages<MailFolder>(client, `${base}/mailFolders`);
    const existing = folders.find(
      (f) => (f.displayName ?? '').toLowerCase() === params.displayName.toLowerCase(),
    );

    if (existing) {
      return formatResponse({
        id: existing.id,
        displayName: existing.displayName,
        created: false,
      });
    }

    // Not found — create it
    const created = await client
      .api(`${base}/mailFolders`)
      .post({ displayName: params.displayName }) as MailFolder;

    return formatResponse({
      id: created.id,
      displayName: created.displayName,
      created: true,
    });
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}
