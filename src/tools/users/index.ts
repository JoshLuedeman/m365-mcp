import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListUsersSchema, SearchUsersSchema, GetUserSchema } from './schemas.js';
import { handleListUsers, handleSearchUsers, handleGetUser } from './handlers.js';

export function register(server: McpServer): void {
  server.tool(
    'list_users',
    'List users in the organization directory',
    ListUsersSchema,
    async ({ top }) => handleListUsers(top),
  );

  server.tool(
    'search_users',
    'Search the organization directory by display name, email, or user principal name',
    SearchUsersSchema,
    async ({ query, top }) => handleSearchUsers(query, top),
  );

  server.tool(
    'get_user',
    'Get a single user profile by ID or user principal name (email)',
    GetUserSchema,
    async ({ userId }) => handleGetUser(userId),
  );
}
