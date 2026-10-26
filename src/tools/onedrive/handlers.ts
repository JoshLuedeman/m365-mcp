import type { DriveItem, Permission } from '@microsoft/microsoft-graph-types';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAccessToken } from '../../auth/index.js';
import { getGraphClient, getApiBase } from '../../graph/client.js';
import { formatResponse, formatError } from '../../utils/formatting.js';
import { parseGraphError } from '../../utils/errors.js';

export async function handleListFiles(folderId?: string, mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);

    const path =
      folderId !== undefined
        ? `${base}/drive/items/${folderId}/children`
        : `${base}/drive/root/children`;

    const response = await client
      .api(path)
      .select('id,name,size,folder,file,lastModifiedDateTime,webUrl,parentReference')
      .get() as { value?: DriveItem[] };

    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleGetFile(itemId: string, mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);

    const item = await client
      .api(`${base}/drive/items/${itemId}`)
      .select('id,name,size,folder,file,lastModifiedDateTime,webUrl,parentReference,createdBy,lastModifiedBy')
      .get() as DriveItem;

    return formatResponse(item);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleSearchFiles(
  query: string,
  top?: number,
  mailbox?: string,
): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);

    let request = client
      .api(`${base}/drive/root/search(q='${encodeURIComponent(query)}')`)
      .select('id,name,size,folder,file,lastModifiedDateTime,webUrl,parentReference');

    if (top !== undefined) {
      request = request.top(top);
    }

    const response = await request.get() as { value?: DriveItem[] };
    return formatResponse(response.value ?? []);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

/**
 * Reads the text content of a file. Graph's /content endpoint returns raw bytes;
 * this handler decodes as UTF-8 text, which is appropriate for text-based files
 * (txt, md, csv, json, etc.) but will produce garbled output for binary formats
 * (docx, xlsx, pdf, images). Callers should check the file's name/extension
 * via handleGetFile before calling this on an unknown file type.
 */
export async function handleReadFileContent(itemId: string, mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);

    const content = await client
      .api(`${base}/drive/items/${itemId}/content`)
      .get() as ArrayBuffer | string;

    const text =
      typeof content === 'string' ? content : Buffer.from(content as ArrayBuffer).toString('utf-8');

    return formatResponse({ itemId, content: text });
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleCreateFolder(
  name: string,
  parentFolderId?: string,
  mailbox?: string,
): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);

    const path =
      parentFolderId !== undefined
        ? `${base}/drive/items/${parentFolderId}/children`
        : `${base}/drive/root/children`;

    const created = await client.api(path).post({
      name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    }) as DriveItem;

    return formatResponse(created);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleDeleteFile(itemId: string, mailbox?: string): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);

    await client.api(`${base}/drive/items/${itemId}`).delete();
    return formatResponse({ deleted: true, itemId });
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

export async function handleMoveFile(
  itemId: string,
  destinationFolderId: string,
  mailbox?: string,
): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(mailbox);

    const moved = await client
      .api(`${base}/drive/items/${itemId}`)
      .patch({ parentReference: { id: destinationFolderId } }) as DriveItem;

    return formatResponse(moved);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}

interface CreateSharingLinkParams {
  itemId: string;
  type?: 'view' | 'edit';
  scope?: 'anonymous' | 'organization';
  mailbox?: string;
}

export async function handleCreateSharingLink(params: CreateSharingLinkParams): Promise<CallToolResult> {
  try {
    const token = await getAccessToken();
    const client = getGraphClient(token);
    const base = getApiBase(params.mailbox);

    const permission = await client
      .api(`${base}/drive/items/${params.itemId}/createLink`)
      .post({
        type: params.type ?? 'view',
        scope: params.scope ?? 'organization',
      }) as Permission;

    return formatResponse(permission);
  } catch (err) {
    return formatError(parseGraphError(err));
  }
}
