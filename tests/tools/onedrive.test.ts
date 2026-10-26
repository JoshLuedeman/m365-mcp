import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/auth/index.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../src/graph/client.js', () => ({
  getGraphClient: vi.fn(),
  getApiBase: vi.fn((mailbox?: string) => (mailbox ? `/users/${mailbox}` : '/me')),
}));

import { getGraphClient } from '../../src/graph/client.js';
import {
  handleListFiles,
  handleGetFile,
  handleSearchFiles,
  handleReadFileContent,
  handleCreateFolder,
  handleDeleteFile,
  handleMoveFile,
  handleCreateSharingLink,
} from '../../src/tools/onedrive/handlers.js';

function makeChain(responses: { get?: unknown; post?: unknown; patch?: unknown } = {}) {
  const chain = {
    filter: vi.fn(),
    top: vi.fn(),
    select: vi.fn(),
    search: vi.fn(),
    header: vi.fn(),
    get: vi.fn().mockResolvedValue(responses.get ?? {}),
    post: vi.fn().mockResolvedValue(responses.post ?? {}),
    patch: vi.fn().mockResolvedValue(responses.patch ?? {}),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  chain.filter.mockReturnValue(chain);
  chain.top.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.search.mockReturnValue(chain);
  chain.header.mockReturnValue(chain);
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

describe('handleListFiles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists drive root children when no folderId given', async () => {
    const items = [{ id: 'f1', name: 'report.docx' }];
    const { client } = makeClient({ get: { value: items } });

    const result = await handleListFiles();

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/me/drive/root/children');
    expect(JSON.parse(result.content[0].text as string)).toEqual(items);
  });

  it('lists a specific folder when folderId given', async () => {
    const { client } = makeClient({ get: { value: [] } });

    await handleListFiles('folder-1');

    expect(client.api).toHaveBeenCalledWith('/me/drive/items/folder-1/children');
  });

  it('routes through getApiBase with mailbox', async () => {
    const { client } = makeClient({ get: { value: [] } });

    await handleListFiles(undefined, 'josh@joshluedeman.com');

    expect(client.api).toHaveBeenCalledWith('/users/josh@joshluedeman.com/drive/root/children');
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleListFiles();

    expect(result.isError).toBe(true);
  });
});

describe('handleGetFile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns file metadata', async () => {
    const item = { id: 'f1', name: 'report.docx', size: 1024 };
    makeClient({ get: item });

    const result = await handleGetFile('f1');

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(item);
  });

  it('returns isError on 404', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(404, 'itemNotFound', 'Not found'));

    const result = await handleGetFile('gone');

    expect(result.isError).toBe(true);
  });
});

describe('handleSearchFiles', () => {
  beforeEach(() => vi.clearAllMocks());

  it('searches and applies top when provided', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleSearchFiles('quarterly report', 10);

    expect(chain.top).toHaveBeenCalledWith(10);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(400, 'BadRequest', 'Invalid query'));

    const result = await handleSearchFiles('x');

    expect(result.isError).toBe(true);
  });
});

describe('handleReadFileContent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns string content directly', async () => {
    makeClient({ get: 'hello world' });

    const result = await handleReadFileContent('f1');

    expect(result.isError).toBeFalsy();
    const body = JSON.parse(result.content[0].text as string);
    expect(body.content).toBe('hello world');
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleReadFileContent('f1');

    expect(result.isError).toBe(true);
  });
});

describe('handleCreateFolder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates at drive root when no parentFolderId given', async () => {
    const { client, chain } = makeClient({ post: { id: 'new', name: 'Reports' } });

    const result = await handleCreateFolder('Reports');

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/me/drive/root/children');
    expect(chain.post).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Reports', folder: {} }),
    );
  });

  it('creates within a parent folder when given', async () => {
    const { client } = makeClient({ post: {} });

    await handleCreateFolder('Subfolder', 'parent-1');

    expect(client.api).toHaveBeenCalledWith('/me/drive/items/parent-1/children');
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.post.mockRejectedValueOnce(makeGraphError(409, 'nameAlreadyExists', 'Conflict'));

    const result = await handleCreateFolder('Dup');

    expect(result.isError).toBe(true);
  });
});

describe('handleDeleteFile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns deleted: true on success', async () => {
    makeClient();

    const result = await handleDeleteFile('f1');

    expect(result.isError).toBeFalsy();
    const body = JSON.parse(result.content[0].text as string);
    expect(body).toEqual({ deleted: true, itemId: 'f1' });
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.delete.mockRejectedValueOnce(makeGraphError(404, 'itemNotFound', 'Not found'));

    const result = await handleDeleteFile('gone');

    expect(result.isError).toBe(true);
  });
});

describe('handleMoveFile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('patches parentReference to the destination folder', async () => {
    const { chain } = makeClient({ patch: { id: 'f1' } });

    await handleMoveFile('f1', 'dest-folder');

    expect(chain.patch).toHaveBeenCalledWith({ parentReference: { id: 'dest-folder' } });
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.patch.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleMoveFile('f1', 'dest');

    expect(result.isError).toBe(true);
  });
});

describe('handleCreateSharingLink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('defaults to view/organization scope', async () => {
    const { chain } = makeClient({ post: { link: { webUrl: 'https://...' } } });

    await handleCreateSharingLink({ itemId: 'f1' });

    expect(chain.post).toHaveBeenCalledWith({ type: 'view', scope: 'organization' });
  });

  it('honors explicit type and scope', async () => {
    const { chain } = makeClient({ post: {} });

    await handleCreateSharingLink({ itemId: 'f1', type: 'edit', scope: 'anonymous' });

    expect(chain.post).toHaveBeenCalledWith({ type: 'edit', scope: 'anonymous' });
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.post.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleCreateSharingLink({ itemId: 'f1' });

    expect(result.isError).toBe(true);
  });
});
