import { describe, it, expect, vi } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import { collectAllPages } from '../../src/utils/pagination.js';

function makeClient(pages: object[]): Client {
  let callCount = 0;

  const get = vi.fn().mockImplementation(() => {
    const page = pages[callCount++];
    return Promise.resolve(page);
  });

  // The graph client chain: client.api(url).get()
  const apiChain = { get };
  const client = {
    api: vi.fn().mockReturnValue(apiChain),
  };

  return client as unknown as Client;
}

describe('collectAllPages', () => {
  it('follows nextLink across two pages and returns all items', async () => {
    const client = makeClient([
      {
        value: [{ id: '1' }, { id: '2' }],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/items?$skip=2',
      },
      {
        value: [{ id: '3' }],
      },
    ]);

    const result = await collectAllPages<{ id: string }>(client, '/me/items');
    expect(result).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
  });

  it('returns items directly when there is no nextLink', async () => {
    const client = makeClient([
      {
        value: [{ id: 'a' }, { id: 'b' }],
      },
    ]);

    const result = await collectAllPages<{ id: string }>(client, '/me/items');
    expect(result).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('returns an empty array when value is empty', async () => {
    const client = makeClient([{ value: [] }]);
    const result = await collectAllPages<{ id: string }>(client, '/me/items');
    expect(result).toEqual([]);
  });

  it('returns an empty array when value property is absent', async () => {
    const client = makeClient([{}]);
    const result = await collectAllPages<{ id: string }>(client, '/me/items');
    expect(result).toEqual([]);
  });

  it('calls api() with the initial url on the first request', async () => {
    const pages = [{ value: [] }];
    let callCount = 0;
    const get = vi.fn().mockImplementation(() => Promise.resolve(pages[callCount++]));
    const apiChain = { get };
    const apiSpy = vi.fn().mockReturnValue(apiChain);
    const client = { api: apiSpy } as unknown as Client;

    await collectAllPages<{ id: string }>(client, '/me/custom-endpoint');
    expect(apiSpy).toHaveBeenCalledWith('/me/custom-endpoint');
  });
});
