import type { Message } from '@microsoft/microsoft-graph-types';

/**
 * Header name Microsoft 365 / Defender for Office 365 uses to carry its bulk/promotions
 * mail classification (the "Promotions" tag surfaced in Outlook on the web and new
 * Outlook for Windows, worldwide GA rollout completed late 2026 — see MC1279093).
 * Microsoft does not document this header or expose the classification as a standard
 * Graph message property or category; it is only observable as a plain RFC5322
 * internet message header, confirmed live against a real mailbox 2026-11-13.
 */
export const BULK_CATEGORY_HEADER = 'x-ms-exchange-organization-bulkcategory';

/**
 * Extracts a case-insensitive named RFC5322 header value from a message's
 * internetMessageHeaders collection. That collection is only populated when the
 * caller's Graph request includes `$select=internetMessageHeaders`; without it this
 * always returns undefined, not "no header present".
 */
export function extractInternetHeader(
  message: Pick<Message, 'internetMessageHeaders'>,
  headerName: string,
): string | undefined {
  const headers = message.internetMessageHeaders;
  if (!Array.isArray(headers)) {
    return undefined;
  }
  const match = headers.find((h) => (h.name ?? '').toLowerCase() === headerName.toLowerCase());
  return match?.value ?? undefined;
}

/**
 * Extracts Microsoft Defender's bulk/promotions mail classification from a message
 * (the same signal behind Outlook's "Promotions" tag and Promotions folder routing).
 *
 * IMPORTANT: Graph does NOT support server-side `$filter` on `internetMessageHeaders`
 * — confirmed live 2026-11-13, Graph returns `ErrorInvalidProperty`:
 * "The property 'internetMessageHeaders' does not support filtering." Any filtering
 * by this value must happen client-side after fetching messages with
 * `$select=internetMessageHeaders` (see handleSearchEmails's bulkCategory param).
 *
 * Returns undefined when the message carries no such header (not bulk-classified) or
 * when internetMessageHeaders wasn't selected on the request.
 */
export function extractBulkCategory(message: Pick<Message, 'internetMessageHeaders'>): string | undefined {
  return extractInternetHeader(message, BULK_CATEGORY_HEADER);
}

/**
 * Strips the (often large — every `Received:` hop included) raw internetMessageHeaders
 * collection from a message object after the fields we care about have already been
 * extracted from it, so responses returned to callers don't balloon with headers that
 * were only ever needed internally for classification parsing.
 */
export function withoutRawHeaders<T extends { internetMessageHeaders?: unknown }>(
  message: T,
): Omit<T, 'internetMessageHeaders'> {
  const rest = { ...message };
  delete (rest as { internetMessageHeaders?: unknown }).internetMessageHeaders;
  return rest;
}
