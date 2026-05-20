import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  SearchContactsSchema,
  GetContactSchema,
  CreateContactSchema,
  UpdateContactSchema,
} from './schemas.js';
import {
  handleSearchContacts,
  handleGetContact,
  handleCreateContact,
  handleUpdateContact,
} from './handlers.js';

export function register(server: McpServer): void {
  server.tool(
    'search_contacts',
    'Search contacts by name, email, company, or other fields',
    SearchContactsSchema,
    async ({ query, top }) => handleSearchContacts(query, top),
  );

  server.tool(
    'get_contact',
    'Get a single contact by ID',
    GetContactSchema,
    async ({ contactId }) => handleGetContact(contactId),
  );

  server.tool(
    'create_contact',
    'Create a new contact in the signed-in user\'s contacts',
    CreateContactSchema,
    async (params) => handleCreateContact(params),
  );

  server.tool(
    'update_contact',
    'Update an existing contact (name, email, phone, title, company)',
    UpdateContactSchema,
    async (params) => handleUpdateContact(params),
  );
}
