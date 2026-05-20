import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  SearchEmailsSchema,
  ReadEmailSchema,
  SendEmailSchema,
  FlagEmailSchema,
  MoveEmailSchema,
} from './schemas.js';
import {
  handleSearchEmails,
  handleReadEmail,
  handleSendEmail,
  handleFlagEmail,
  handleListMailFolders,
  handleMoveEmail,
} from './handlers.js';

export function register(server: McpServer): void {
  server.tool(
    'search_emails',
    'Search emails by query, sender, date range, or folder',
    SearchEmailsSchema,
    async (params) => handleSearchEmails(params),
  );

  server.tool(
    'read_email',
    'Read the full content of an email message by ID',
    ReadEmailSchema,
    async ({ messageId }) => handleReadEmail(messageId),
  );

  server.tool(
    'send_email',
    'Send an email to one or more recipients',
    SendEmailSchema,
    async (params) => handleSendEmail(params),
  );

  server.tool(
    'flag_email',
    'Set the flag status on an email (flagged, complete, or notFlagged)',
    FlagEmailSchema,
    async ({ messageId, flagStatus }) => handleFlagEmail(messageId, flagStatus),
  );

  server.tool(
    'list_mail_folders',
    'List all mail folders for the signed-in user',
    {},
    async () => handleListMailFolders(),
  );

  server.tool(
    'move_email',
    'Move an email to a different mail folder',
    MoveEmailSchema,
    async ({ messageId, destinationFolderId }) =>
      handleMoveEmail(messageId, destinationFolderId),
  );
}
