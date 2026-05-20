import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface GraphErrorResponse {
  code?: string;
  message?: string;
  innerError?: {
    code?: string;
    message?: string;
    'retry-after'?: string;
  };
}

interface GraphErrorBody {
  error?: GraphErrorResponse;
}

interface GraphApiError {
  statusCode?: number;
  body?: string | GraphErrorBody;
  message?: string;
}

/**
 * Parses a Microsoft Graph API error into a human-readable string.
 * Handles 429 throttling by surfacing retry-after information.
 */
export function parseGraphError(err: unknown): string {
  if (err instanceof Error) {
    // Graph client wraps errors with statusCode + body
    const graphErr = err as GraphApiError & Error;

    if (graphErr.statusCode === 429) {
      let retryAfter = 'unknown';
      try {
        if (typeof graphErr.body === 'string') {
          const parsed = JSON.parse(graphErr.body) as GraphErrorBody;
          retryAfter = parsed.error?.innerError?.['retry-after'] ?? 'unknown';
        } else if (typeof graphErr.body === 'object' && graphErr.body !== null) {
          retryAfter = graphErr.body.error?.innerError?.['retry-after'] ?? 'unknown';
        }
      } catch {
        // ignore parse errors
      }
      return `Graph API rate limit exceeded (429). Retry after ${retryAfter} seconds.`;
    }

    if (graphErr.statusCode !== undefined && graphErr.body !== undefined) {
      try {
        const body: GraphErrorBody =
          typeof graphErr.body === 'string'
            ? (JSON.parse(graphErr.body) as GraphErrorBody)
            : graphErr.body;

        const code = body.error?.code ?? 'UnknownError';
        const message = body.error?.message ?? graphErr.message;
        return `Graph API error [${graphErr.statusCode}] ${code}: ${message}`;
      } catch {
        return `Graph API error [${graphErr.statusCode}]: ${graphErr.message}`;
      }
    }

    return `Error: ${err.message}`;
  }

  return `Unexpected error: ${String(err)}`;
}

/**
 * Creates an MCP protocol error with a clean error message.
 */
export function createMcpError(message: string): McpError {
  return new McpError(ErrorCode.InternalError, message);
}
