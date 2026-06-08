import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/auth/device-code-flow.js', () => ({
  acquireToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../src/graph/client.js', () => ({
  getGraphClient: vi.fn(),
}));

import { getGraphClient } from '../../src/graph/client.js';
import {
  handleSearchContacts,
  handleGetContact,
  handleCreateContact,
  handleUpdateContact,
} from '../../src/tools/contacts/handlers.js';

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
// handleSearchContacts
// ---------------------------------------------------------------------------

describe('handleSearchContacts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns contacts matching the query', async () => {
    const contacts = [{ id: 'c1', displayName: 'Glen Small' }];
    makeClient({ get: { value: contacts } });

    const result = await handleSearchContacts('Glen');

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(contacts);
  });

  it('applies search with quoted query', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleSearchContacts('Glen Small');

    expect(chain.search).toHaveBeenCalledWith('"Glen Small"');
  });

  it('applies top when provided', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleSearchContacts('test', 5);

    expect(chain.top).toHaveBeenCalledWith(5);
  });

  it('does not apply top when not provided', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleSearchContacts('test');

    expect(chain.top).not.toHaveBeenCalled();
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleSearchContacts('someone');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('403');
  });
});

// ---------------------------------------------------------------------------
// handleGetContact
// ---------------------------------------------------------------------------

describe('handleGetContact', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a contact by id', async () => {
    const contact = { id: 'c1', displayName: 'Glen Small', jobTitle: 'Mentor' };
    makeClient({ get: contact });

    const result = await handleGetContact('c1');

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(contact);
  });

  it('calls the correct endpoint', async () => {
    const { client } = makeClient({ get: {} });

    await handleGetContact('contact-xyz');

    expect(client.api).toHaveBeenCalledWith('/me/contacts/contact-xyz');
  });

  it('returns isError on 404', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Contact not found'));

    const result = await handleGetContact('gone');

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleCreateContact
// ---------------------------------------------------------------------------

describe('handleCreateContact', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a contact with required fields only', async () => {
    const created = { id: 'new-c', givenName: 'Scott' };
    const { chain } = makeClient({ post: created });

    const result = await handleCreateContact({ givenName: 'Scott' });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text as string)).toEqual(created);
    expect(chain.post).toHaveBeenCalledWith(expect.objectContaining({ givenName: 'Scott' }));
  });

  it('includes optional fields when provided', async () => {
    const { chain } = makeClient({ post: {} });

    await handleCreateContact({
      givenName: 'Scott',
      surname: 'Lowe',
      jobTitle: 'AI Governance Lead',
      companyName: 'Acme Corp',
      emailAddresses: [{ address: 'scott@acme.com' }],
      businessPhones: ['+1-555-0100'],
    });

    expect(chain.post).toHaveBeenCalledWith(
      expect.objectContaining({
        givenName: 'Scott',
        surname: 'Lowe',
        jobTitle: 'AI Governance Lead',
        companyName: 'Acme Corp',
      }),
    );
  });

  it('posts to /me/contacts', async () => {
    const { client } = makeClient({ post: {} });

    await handleCreateContact({ givenName: 'Test' });

    expect(client.api).toHaveBeenCalledWith('/me/contacts');
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.post.mockRejectedValueOnce(makeGraphError(400, 'BadRequest', 'Invalid contact'));

    const result = await handleCreateContact({ givenName: 'Bad' });

    expect(result.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleUpdateContact
// ---------------------------------------------------------------------------

describe('handleUpdateContact', () => {
  beforeEach(() => vi.clearAllMocks());

  it('patches only the provided fields', async () => {
    const { chain } = makeClient({ patch: { id: 'c1', jobTitle: 'Director' } });

    const result = await handleUpdateContact({ contactId: 'c1', jobTitle: 'Director' });

    expect(result.isError).toBeFalsy();
    expect(chain.patch).toHaveBeenCalledWith(expect.objectContaining({ jobTitle: 'Director' }));
    expect(chain.patch).toHaveBeenCalledWith(
      expect.not.objectContaining({ givenName: expect.anything() }),
    );
  });

  it('calls the correct endpoint', async () => {
    const { client } = makeClient({ patch: {} });

    await handleUpdateContact({ contactId: 'contact-abc' });

    expect(client.api).toHaveBeenCalledWith('/me/contacts/contact-abc');
  });

  it('returns isError on 404', async () => {
    const { chain } = makeClient();
    chain.patch.mockRejectedValueOnce(makeGraphError(404, 'ItemNotFound', 'Contact not found'));

    const result = await handleUpdateContact({ contactId: 'gone', jobTitle: 'Title' });

    expect(result.isError).toBe(true);
  });
});
