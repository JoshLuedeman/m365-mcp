import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Shapes arbitrary data into an MCP CallToolResult with a single text content block.
 * All Graph API responses flow through here for consistent serialization.
 */
export function formatResponse(data: unknown): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Returns a formatted error result (isError: true) for tool-level error reporting.
 * Use this when an error should be surfaced to the LLM rather than thrown as an MCP protocol error.
 */
export function formatError(message: string): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
    isError: true,
  };
}
