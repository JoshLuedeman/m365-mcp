import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  SearchEmailsSchema,
  ReadEmailSchema,
  SendEmailSchema,
  FlagEmailSchema,
  MoveEmailSchema,
  ReplyEmailSchema,
  DeleteEmailSchema,
  MarkReadSchema,
  EnsureFolderSchema,
} from './schemas.js';
import {
  handleSearchEmails,
  handleReadEmail,
  handleSendEmail,
  handleFlagEmail,
  handleListMailFolders,
  handleMoveEmail,
  handleReplyEmail,
  handleDeleteEmail,
  handleMarkRead,
  handleEnsureFolder,
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
    async ({ messageId, mailbox }) => handleReadEmail(messageId, mailbox),
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
    async ({ messageId, flagStatus, mailbox }) => handleFlagEmail(messageId, flagStatus, mailbox),
  );

  server.tool(
    'list_mail_folders',
    'List all mail folders for the signed-in user',
    { mailbox: SearchEmailsSchema.mailbox },
    async ({ mailbox }) => handleListMailFolders(mailbox),
  );

  server.tool(
    'move_email',
    'Move an email to a different mail folder',
    MoveEmailSchema,
    async ({ messageId, destinationFolderId, mailbox }) =>
      handleMoveEmail(messageId, destinationFolderId, mailbox),
  );

  server.tool(
    'reply_email',
    'Reply to an email message (or reply-all)',
    ReplyEmailSchema,
    async (params) => handleReplyEmail(params),
  );

  server.tool(
    'delete_email',
    'Delete an email (soft delete to Deleted Items, or permanent hard delete)',
    DeleteEmailSchema,
    async (params) => handleDeleteEmail(params),
  );

  server.tool(
    'mark_read',
    'Mark an email as read or unread',
    MarkReadSchema,
    async (params) => handleMarkRead(params),
  );

  server.tool(
    'ensure_folder',
    'Get an existing mail folder by name, or create it if it does not exist. Returns the folder ID and a created flag.',
    EnsureFolderSchema,
    async (params) => handleEnsureFolder(params),
  );
}
