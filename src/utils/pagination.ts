import type { Client } from '@microsoft/microsoft-graph-client';

interface PagedResponse<T> {
  value?: T[];
  '@odata.nextLink'?: string;
}

/**
 * Follows @odata.nextLink cursors to collect all pages for a Graph API list response.
 * Returns an empty array if the first response has no `value` property.
 */
export async function collectAllPages<T>(client: Client, url: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | undefined = url;

  while (nextUrl !== undefined) {
    const response = await client.api(nextUrl).get() as PagedResponse<T>;

    if (Array.isArray(response.value)) {
      results.push(...response.value);
    }

    nextUrl = response['@odata.nextLink'];
  }

  return results;
}
