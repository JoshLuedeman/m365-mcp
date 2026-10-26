import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/auth/index.js', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('../../src/graph/client.js', () => ({
  getGraphClient: vi.fn(),
}));

import { getGraphClient } from '../../src/graph/client.js';
import { handleListUsers, handleSearchUsers, handleGetUser } from '../../src/tools/users/handlers.js';

function makeChain(responses: { get?: unknown } = {}) {
  const chain = {
    filter: vi.fn(),
    top: vi.fn(),
    select: vi.fn(),
    get: vi.fn().mockResolvedValue(responses.get ?? {}),
  };
  chain.filter.mockReturnValue(chain);
  chain.top.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  return chain;
}

function makeClient(responses: { get?: unknown } = {}) {
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

describe('handleListUsers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists users with default select fields', async () => {
    const users = [{ id: 'u1', displayName: 'Bradley Ball' }];
    const { client, chain } = makeClient({ get: { value: users } });

    const result = await handleListUsers();

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/users');
    expect(chain.select).toHaveBeenCalledWith('id,displayName,userPrincipalName,mail,jobTitle,department');
    expect(JSON.parse(result.content[0].text as string)).toEqual(users);
  });

  it('applies top when provided', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleListUsers(10);

    expect(chain.top).toHaveBeenCalledWith(10);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleListUsers();

    expect(result.isError).toBe(true);
  });
});

describe('handleSearchUsers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters by displayName/mail/userPrincipalName prefix', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleSearchUsers('Josh');

    expect(chain.filter).toHaveBeenCalledWith(
      "startsWith(displayName,'Josh') or startsWith(mail,'Josh') or startsWith(userPrincipalName,'Josh')",
    );
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(400, 'BadRequest', 'Invalid filter'));

    const result = await handleSearchUsers('x');

    expect(result.isError).toBe(true);
  });
});

describe('handleGetUser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a single user by id or UPN', async () => {
    const user = { id: 'u1', displayName: 'Josh Luedeman', mail: 'josh@joshluedeman.com' };
    const { client } = makeClient({ get: user });

    const result = await handleGetUser('josh@joshluedeman.com');

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/users/josh@joshluedeman.com');
    expect(JSON.parse(result.content[0].text as string)).toEqual(user);
  });

  it('returns isError on 404', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(404, 'Request_ResourceNotFound', 'User not found'));

    const result = await handleGetUser('nobody@joshluedeman.com');

    expect(result.isError).toBe(true);
  });
});
