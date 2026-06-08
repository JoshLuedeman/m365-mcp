import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/auth/device-code-flow.js', () => ({
  acquireToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../src/graph/client.js', () => ({
  getGraphClient: vi.fn(),
}));

import { getGraphClient } from '../../src/graph/client.js';
import {
  handleSearchEmails,
  handleReadEmail,
  handleSendEmail,
  handleFlagEmail,
  handleListMailFolders,
  handleMoveEmail,
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

  it('calls the correct endpoint', async () => {
    const { client } = makeClient({ get: { id: 'm1' } });

    await handleReadEmail('message-abc');

    expect(client.api).toHaveBeenCalledWith('/me/messages/message-abc');
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
    const { chain } = makeClient({ post: undefined });

    const result = await handleSendEmail({
      to: ['recipient@example.com'],
      subject: 'Test email',
      body: 'Hello there',
    });

    expect(result.isError).toBeFalsy();
    const body = JSON.parse(result.content[0].text as string);
    expect(body).toEqual({ sent: true, subject: 'Test email' });
  });

  it('sends to /me/sendMail', async () => {
    const { client } = makeClient({ post: undefined });

    await handleSendEmail({ to: ['a@b.com'], subject: 'Hi', body: 'Body' });

    expect(client.api).toHaveBeenCalledWith('/me/sendMail');
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
