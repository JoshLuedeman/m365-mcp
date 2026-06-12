import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Updated mock: handlers now use the unified auth entry point
// ---------------------------------------------------------------------------
vi.mock('../../src/auth/index.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../src/graph/client.js', () => ({
  getGraphClient: vi.fn(),
  getApiBase: vi.fn((mailbox?: string) => (mailbox ? `/users/${mailbox}` : '/me')),
}));

import { getGraphClient, getApiBase } from '../../src/graph/client.js';
import {
  handleSearchEmails,
  handleReadEmail,
  handleSendEmail,
  handleFlagEmail,
  handleListMailFolders,
  handleMoveEmail,
  handleReplyEmail,
  handleDeleteEmail,
  handleMarkRead,
  handleEnsureFolder,
} from '../../src/tools/mail/handlers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChain(responses: { get?: unknown; post?: unknown; patch?: unknown } = {}) {
  const chain = {
    filter: vi.fn(),
    top: vi.fn(),
    select: vi.fn(),
    search: vi.fn(),
    get: vi.fn().mockResolvedValue(responses.get ?? {}),
    post: vi.fn().mockResolvedValue(responses.post ?? {}),
    patch: vi.fn().mockResolvedValue(responses.patch ?? {}),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  chain.filter.mockReturnValue(chain);
  chain.top.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.search.mockReturnValue(chain);
  return chain;
}

function makeClient(responses: { get?: unknown; post?: unknown; patch?: unknown } = {}) {
  const chain = makeChain(responses);
  const client = { api: vi.fn().mockReturnValue(chain) };
  vi.mocked(getGraphClient).mockReturnValue(client as ReturnType<typeof getGraphClient>);
  return { client, chain };
}

function makeGraphError(statusCode: number, code: string, message: string) {
  return Object.assign(new Error(message), {
    statusCode,
    body: JSON.stringify({ error: { code, message } }),
  });
}

// ---------------------------------------------------------------------------
// handleSearchEmails
// ---------------------------------------------------------------------------

describe('handleSearchEmails', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns emails on success with no filters', async () => {
    const messages = [{ id: 'm1', subject: 'Hello' }];
    makeClient({ get: { value: messages } });

    const result = await handleSearchEmails({});

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(messages);
  });

  it('uses inbox folder path when folder is provided', async () => {
    const { client } = makeClient({ get: { value: [] } });

    await handleSearchEmails({ folder: 'Inbox' });

    expect(client.api).toHaveBeenCalledWith('/me/mailFolders/Inbox/messages');
  });

  it('uses /me/messages when no folder is provided', async () => {
    const { client } = makeClient({ get: { value: [] } });

    await handleSearchEmails({});

    expect(client.api).toHaveBeenCalledWith('/me/messages');
  });

  it('applies search when query is provided', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleSearchEmails({ query: 'project update' });

    expect(chain.search).toHaveBeenCalledWith('"project update"');
  });

  it('applies filter for from address', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleSearchEmails({ from: 'boss@example.com' });

    expect(chain.filter).toHaveBeenCalledWith(
      expect.stringContaining("from/emailAddress/address eq 'boss@example.com'"),
    );
  });

  it('applies top when provided', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleSearchEmails({ top: 25 });

    expect(chain.top).toHaveBeenCalledWith(25);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleSearchEmails({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('403');
  });

  // --- mailbox routing ---
  it('uses /users/{mailbox}/messages when mailbox is provided', async () => {
    const { client } = makeClient({ get: { value: [] } });
    vi.mocked(getApiBase).mockReturnValueOnce('/users/user@example.com');

    await handleSearchEmails({ mailbox: 'user@example.com' });

    expect(getApiBase).toHaveBeenCalledWith('user@example.com');
    expect(client.api).toHaveBeenCalledWith('/users/user@example.com/messages');
  });

  it('uses /me/ when no mailbox is provided', async () => {
    const { client } = makeClient({ get: { value: [] } });
    vi.mocked(getApiBase).mockReturnValueOnce('/me');

    await handleSearchEmails({});

    expect(getApiBase).toHaveBeenCalledWith(undefined);
    expect(client.api).toHaveBeenCalledWith('/me/messages');
  });
});

// ---------------------------------------------------------------------------
// handleReadEmail
// ---------------------------------------------------------------------------

describe('handleReadEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns full email content', async () => {
    const message = { id: 'm1', subject: 'Hello', body: { content: 'World' } };
    makeClient({ get: message });

    const result = await handleReadEmail('m1');

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(message);
  });

  it('calls the correct endpoint without mailbox', async () => {
    const { client } = makeClient({ get: { id: 'm1' } });
    vi.mocked(getApiBase).mockReturnValueOnce('/me');

    await handleReadEmail('message-abc');

    expect(client.api).toHaveBeenCalledWith('/me/messages/message-abc');
  });

  it('calls /users/{mailbox}/messages/{id} when mailbox is provided', async () => {
    const { client } = makeClient({ get: { id: 'm1' } });
    vi.mocked(getApiBase).mockReturnValueOnce('/users/user@example.com');

    await handleReadEmail('message-abc', 'user@example.com');

    expect(client.api).toHaveBeenCalledWith('/users/user@example.com/messages/message-abc');
  });

  it('returns isError on 404', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Message not found'));

    const result = await handleReadEmail('gone');

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleSendEmail
// ---------------------------------------------------------------------------

describe('handleSendEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns sent: true on success', async () => {
    makeClient({ post: undefined });

    const result = await handleSendEmail({
      to: ['recipient@example.com'],
      subject: 'Test email',
      body: 'Hello there',
    });

    expect(result.isError).toBeFalsy();
    const body = JSON.parse(result.content[0].text as string);
    expect(body).toEqual({ sent: true, subject: 'Test email' });
  });

  it('sends to /me/sendMail by default', async () => {
    const { client } = makeClient({ post: undefined });
    vi.mocked(getApiBase).mockReturnValueOnce('/me');

    await handleSendEmail({ to: ['a@b.com'], subject: 'Hi', body: 'Body' });

    expect(client.api).toHaveBeenCalledWith('/me/sendMail');
  });

  it('sends to /users/{mailbox}/sendMail when mailbox provided', async () => {
    const { client } = makeClient({ post: undefined });
    vi.mocked(getApiBase).mockReturnValueOnce('/users/user@example.com');

    await handleSendEmail({ to: ['a@b.com'], subject: 'Hi', body: 'Body', mailbox: 'user@example.com' });

    expect(client.api).toHaveBeenCalledWith('/users/user@example.com/sendMail');
  });

  it('includes cc and bcc when provided', async () => {
    const { chain } = makeClient({ post: undefined });

    await handleSendEmail({
      to: ['to@example.com'],
      subject: 'Subject',
      body: 'Body',
      cc: ['cc@example.com'],
      bcc: ['bcc@example.com'],
    });

    const callArg = chain.post.mock.calls[0][0] as { message: Record<string, unknown> };
    expect(callArg.message.ccRecipients).toBeDefined();
    expect(callArg.message.bccRecipients).toBeDefined();
  });

  it('defaults contentType to text', async () => {
    const { chain } = makeClient({ post: undefined });

    await handleSendEmail({ to: ['a@b.com'], subject: 'S', body: 'B' });

    const callArg = chain.post.mock.calls[0][0] as { message: { body: { contentType: string } } };
    expect(callArg.message.body.contentType).toBe('text');
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.post.mockRejectedValueOnce(makeGraphError(400, 'BadRequest', 'Invalid recipient'));

    const result = await handleSendEmail({ to: ['bad'], subject: 'S', body: 'B' });

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleFlagEmail
// ---------------------------------------------------------------------------

describe('handleFlagEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('patches the flag status', async () => {
    const { chain } = makeClient({ patch: { id: 'm1', flag: { flagStatus: 'flagged' } } });

    const result = await handleFlagEmail('m1', 'flagged');

    expect(result.isError).toBeFalsy();
    expect(chain.patch).toHaveBeenCalledWith({ flag: { flagStatus: 'flagged' } });
  });

  it('calls the correct endpoint', async () => {
    const { client } = makeClient({ patch: {} });
    vi.mocked(getApiBase).mockReturnValueOnce('/me');

    await handleFlagEmail('message-xyz', 'notFlagged');

    expect(client.api).toHaveBeenCalledWith('/me/messages/message-xyz');
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.patch.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Message not found'));

    const result = await handleFlagEmail('gone', 'flagged');

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleListMailFolders
// ---------------------------------------------------------------------------

describe('handleListMailFolders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mail folders', async () => {
    const folders = [{ id: 'f1', displayName: 'Inbox' }, { id: 'f2', displayName: 'Sent Items' }];
    makeClient({ get: { value: folders } });

    const result = await handleListMailFolders();

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(folders);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(401, 'Unauthorized', 'Token expired'));

    const result = await handleListMailFolders();

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleMoveEmail
// ---------------------------------------------------------------------------

describe('handleMoveEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the moved message', async () => {
    const moved = { id: 'm1', parentFolderId: 'archive-folder' };
    const { chain } = makeClient({ post: moved });

    const result = await handleMoveEmail('m1', 'archive-folder');

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(moved);
    expect(chain.post).toHaveBeenCalledWith({ destinationId: 'archive-folder' });
  });

  it('calls the correct move endpoint', async () => {
    const { client } = makeClient({ post: {} });
    vi.mocked(getApiBase).mockReturnValueOnce('/me');

    await handleMoveEmail('message-abc', 'folder-xyz');

    expect(client.api).toHaveBeenCalledWith('/me/messages/message-abc/move');
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.post.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Message not found'));

    const result = await handleMoveEmail('gone', 'folder');

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleReplyEmail
// ---------------------------------------------------------------------------

describe('handleReplyEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls the reply endpoint for a single reply', async () => {
    const { client } = makeClient({ post: undefined });
    vi.mocked(getApiBase).mockReturnValueOnce('/me');

    const result = await handleReplyEmail({ messageId: 'm1', body: 'Thanks!' });

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/me/messages/m1/reply');
  });

  it('calls the replyAll endpoint when replyAll=true', async () => {
    const { client } = makeClient({ post: undefined });
    vi.mocked(getApiBase).mockReturnValueOnce('/me');

    const result = await handleReplyEmail({ messageId: 'm2', body: 'All!', replyAll: true });

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/me/messages/m2/replyAll');
  });

  it('uses comment body for text replies', async () => {
    const { chain } = makeClient({ post: undefined });

    await handleReplyEmail({ messageId: 'm1', body: 'Hello', contentType: 'text' });

    expect(chain.post).toHaveBeenCalledWith({ comment: 'Hello' });
  });

  it('uses message body for html replies', async () => {
    const { chain } = makeClient({ post: undefined });

    await handleReplyEmail({ messageId: 'm1', body: '<b>Hello</b>', contentType: 'html' });

    const call = chain.post.mock.calls[0][0] as { comment: string; message: { body: { contentType: string; content: string } } };
    expect(call.message.body.contentType).toBe('html');
    expect(call.message.body.content).toBe('<b>Hello</b>');
  });

  it('routes to /users/{mailbox}/ when mailbox is provided', async () => {
    const { client } = makeClient({ post: undefined });
    vi.mocked(getApiBase).mockReturnValueOnce('/users/user@example.com');

    await handleReplyEmail({ messageId: 'm3', body: 'Reply', mailbox: 'user@example.com' });

    expect(client.api).toHaveBeenCalledWith('/users/user@example.com/messages/m3/reply');
  });

  it('returns replied=true on success', async () => {
    makeClient({ post: undefined });
    vi.mocked(getApiBase).mockReturnValueOnce('/me');

    const result = await handleReplyEmail({ messageId: 'm1', body: 'OK' });

    const body = JSON.parse(result.content[0].text as string);
    expect(body.replied).toBe(true);
    expect(body.messageId).toBe('m1');
    expect(body.replyAll).toBe(false);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.post.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Not found'));

    const result = await handleReplyEmail({ messageId: 'gone', body: 'Oops' });

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleDeleteEmail
// ---------------------------------------------------------------------------

describe('handleDeleteEmail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('moves to deleteditems when permanent=false (default)', async () => {
    const { client, chain } = makeClient({ post: { id: 'moved-m1' } });
    vi.mocked(getApiBase).mockReturnValueOnce('/me');

    const result = await handleDeleteEmail({ messageId: 'm1' });

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/me/messages/m1/move');
    expect(chain.post).toHaveBeenCalledWith({ destinationId: 'deleteditems' });

    const body = JSON.parse(result.content[0].text as string);
    expect(body.deleted).toBe(true);
    expect(body.permanent).toBe(false);
    expect(body.movedTo).toBe('deleteditems');
  });

  it('hard-deletes when permanent=true', async () => {
    const { client, chain } = makeClient();
    vi.mocked(getApiBase).mockReturnValueOnce('/me');

    const result = await handleDeleteEmail({ messageId: 'm1', permanent: true });

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/me/messages/m1');
    expect(chain.delete).toHaveBeenCalledOnce();

    const body = JSON.parse(result.content[0].text as string);
    expect(body.permanent).toBe(true);
  });

  it('routes to /users/{mailbox}/ when mailbox is provided', async () => {
    const { client } = makeClient({ post: {} });
    vi.mocked(getApiBase).mockReturnValueOnce('/users/user@example.com');

    await handleDeleteEmail({ messageId: 'm1', mailbox: 'user@example.com' });

    expect(client.api).toHaveBeenCalledWith('/users/user@example.com/messages/m1/move');
  });

  it('returns isError on Graph failure (soft delete)', async () => {
    const { chain } = makeClient();
    chain.post.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Not found'));

    const result = await handleDeleteEmail({ messageId: 'gone' });

    expect(result.isError).toBe(true);
  });

  it('returns isError on Graph failure (permanent delete)', async () => {
    const { chain } = makeClient();
    chain.delete.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleDeleteEmail({ messageId: 'm1', permanent: true });

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleMarkRead
// ---------------------------------------------------------------------------

describe('handleMarkRead', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks email as read (default)', async () => {
    const { client, chain } = makeClient({ patch: { id: 'm1', isRead: true } });
    vi.mocked(getApiBase).mockReturnValueOnce('/me');

    const result = await handleMarkRead({ messageId: 'm1' });

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/me/messages/m1');
    expect(chain.patch).toHaveBeenCalledWith({ isRead: true });
  });

  it('marks email as unread when isRead=false', async () => {
    const { chain } = makeClient({ patch: { id: 'm1', isRead: false } });

    await handleMarkRead({ messageId: 'm1', isRead: false });

    expect(chain.patch).toHaveBeenCalledWith({ isRead: false });
  });

  it('marks email as read when isRead=true explicitly', async () => {
    const { chain } = makeClient({ patch: { id: 'm1', isRead: true } });

    await handleMarkRead({ messageId: 'm1', isRead: true });

    expect(chain.patch).toHaveBeenCalledWith({ isRead: true });
  });

  it('routes to /users/{mailbox}/ when mailbox is provided', async () => {
    const { client } = makeClient({ patch: {} });
    vi.mocked(getApiBase).mockReturnValueOnce('/users/user@example.com');

    await handleMarkRead({ messageId: 'm1', mailbox: 'user@example.com' });

    expect(client.api).toHaveBeenCalledWith('/users/user@example.com/messages/m1');
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.patch.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Not found'));

    const result = await handleMarkRead({ messageId: 'gone' });

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getApiBase helper (mocked behavior verification)
// ---------------------------------------------------------------------------

describe('getApiBase (via graph/client mock)', () => {
  it('returns /me when no mailbox', () => {
    // Our vi.mock at the top defines getApiBase as: (mailbox?) => mailbox ? `/users/${mailbox}` : '/me'
    expect(getApiBase(undefined)).toBe('/me');
  });

  it('returns /users/{mailbox} when mailbox is provided', () => {
    expect(getApiBase('user@example.com')).toBe('/users/user@example.com');
  });
});

// ---------------------------------------------------------------------------
// handleEnsureFolder
// ---------------------------------------------------------------------------

describe('handleEnsureFolder', () => {
  let mockClient: ReturnType<typeof vi.fn>;
  let mockApi: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockApi = vi.fn();
    mockClient = vi.fn().mockReturnValue({ api: mockApi });
    (getGraphClient as ReturnType<typeof vi.fn>).mockReturnValue({ api: mockApi });
  });

  it('returns existing folder without creating when name matches (case-insensitive)', async () => {
    const existingFolder = { id: 'folder-123', displayName: 'Newsletters' };
    // First call: GET /mailFolders (list)
    mockApi.mockReturnValue({
      get: vi.fn().mockResolvedValue({ value: [existingFolder], '@odata.nextLink': undefined }),
      post: vi.fn(),
    });

    const result = await handleEnsureFolder({ displayName: 'newsletters' });
    const data = JSON.parse((result.content[0] as { text: string }).text);

    expect(data.id).toBe('folder-123');
    expect(data.displayName).toBe('Newsletters');
    expect(data.created).toBe(false);
  });

  it('creates folder when name does not exist', async () => {
    const newFolder = { id: 'new-folder-456', displayName: 'Receipts' };
    const apiObj = {
      get: vi.fn().mockResolvedValue({ value: [], '@odata.nextLink': undefined }),
      post: vi.fn().mockResolvedValue(newFolder),
    };
    mockApi.mockReturnValue(apiObj);

    const result = await handleEnsureFolder({ displayName: 'Receipts' });
    const data = JSON.parse((result.content[0] as { text: string }).text);

    expect(data.id).toBe('new-folder-456');
    expect(data.displayName).toBe('Receipts');
    expect(data.created).toBe(true);
  });

  it('uses /me/mailFolders when no mailbox provided', async () => {
    const apiObj = {
      get: vi.fn().mockResolvedValue({ value: [], '@odata.nextLink': undefined }),
      post: vi.fn().mockResolvedValue({ id: 'x', displayName: 'Test' }),
    };
    mockApi.mockReturnValue(apiObj);

    await handleEnsureFolder({ displayName: 'Test' });

    expect(mockApi).toHaveBeenCalledWith('/me/mailFolders');
  });

  it('uses /users/{mailbox}/mailFolders when mailbox is provided', async () => {
    const apiObj = {
      get: vi.fn().mockResolvedValue({ value: [], '@odata.nextLink': undefined }),
      post: vi.fn().mockResolvedValue({ id: 'x', displayName: 'Test' }),
    };
    mockApi.mockReturnValue(apiObj);

    await handleEnsureFolder({ displayName: 'Test', mailbox: 'josh@example.com' });

    expect(mockApi).toHaveBeenCalledWith('/users/josh@example.com/mailFolders');
  });

  it('returns isError on Graph failure', async () => {
    mockApi.mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error('Graph error')),
    });

    const result = await handleEnsureFolder({ displayName: 'Test' });
    expect(result.isError).toBe(true);
  });
});
