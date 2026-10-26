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
  handleListJoinedTeams,
  handleListChannels,
  handleListChannelMessages,
  handleListChats,
  handleListChatMessages,
} from '../../src/tools/teams/handlers.js';

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

describe('handleListJoinedTeams', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters groups to Team-provisioned ones', async () => {
    const teams = [{ id: 't1', displayName: 'Tales from the Field' }];
    const { client, chain } = makeClient({ get: { value: teams } });

    const result = await handleListJoinedTeams();

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/groups');
    expect(chain.filter).toHaveBeenCalledWith("resourceProvisioningOptions/Any(x:x eq 'Team')");
    expect(JSON.parse(result.content[0].text as string)).toEqual(teams);
  });

  it('applies top when provided', async () => {
    const { chain } = makeClient({ get: { value: [] } });

    await handleListJoinedTeams(5);

    expect(chain.top).toHaveBeenCalledWith(5);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleListJoinedTeams();

    expect(result.isError).toBe(true);
  });
});

describe('handleListChannels', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists channels for a team', async () => {
    const channels = [{ id: 'c1', displayName: 'General' }];
    const { client } = makeClient({ get: { value: channels } });

    const result = await handleListChannels('team-1');

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/teams/team-1/channels');
    expect(JSON.parse(result.content[0].text as string)).toEqual(channels);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(404, 'NotFound', 'Team not found'));

    const result = await handleListChannels('gone');

    expect(result.isError).toBe(true);
  });
});

describe('handleListChannelMessages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists messages for a channel', async () => {
    const messages = [{ id: 'm1', body: { content: 'hello' } }];
    const { client, chain } = makeClient({ get: { value: messages } });

    const result = await handleListChannelMessages('team-1', 'chan-1', 20);

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/teams/team-1/channels/chan-1/messages');
    expect(chain.top).toHaveBeenCalledWith(20);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleListChannelMessages('t1', 'c1');

    expect(result.isError).toBe(true);
  });
});

describe('handleListChats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists chats for the default mailbox (/me)', async () => {
    const chats = [{ id: 'chat1', topic: '1:1 chat' }];
    const { client } = makeClient({ get: { value: chats } });

    const result = await handleListChats();

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/me/chats');
  });

  it('routes through getApiBase with mailbox', async () => {
    const { client } = makeClient({ get: { value: [] } });

    await handleListChats('josh@joshluedeman.com');

    expect(client.api).toHaveBeenCalledWith('/users/josh@joshluedeman.com/chats');
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(403, 'AccessDenied', 'Forbidden'));

    const result = await handleListChats();

    expect(result.isError).toBe(true);
  });
});

describe('handleListChatMessages', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists messages for a chat', async () => {
    const messages = [{ id: 'm1' }];
    const { client, chain } = makeClient({ get: { value: messages } });

    const result = await handleListChatMessages('chat-1', 10);

    expect(result.isError).toBeFalsy();
    expect(client.api).toHaveBeenCalledWith('/me/chats/chat-1/messages');
    expect(chain.top).toHaveBeenCalledWith(10);
  });

  it('returns isError on Graph failure', async () => {
    const { chain } = makeClient();
    chain.get.mockRejectedValueOnce(makeGraphError(404, 'NotFound', 'Chat not found'));

    const result = await handleListChatMessages('gone');

    expect(result.isError).toBe(true);
  });
});
