import { z } from 'zod';

// Shared mailbox field — optional on all mail tools.
// When provided, uses /users/{mailbox}/ endpoints (app-only / client credentials).
// When absent, uses /me/ endpoints (device code / delegated).
const mailboxField = z
  .string()
  .optional()
  .describe(
    'Mailbox UPN or object ID (e.g. user@domain.com). Required for client_credentials auth; omit for device_code auth.',
  );

export const SearchEmailsSchema = {
  query: z.string().optional().describe('Full-text search query across email subject and body'),
  from: z.string().optional().describe('Filter by sender email address'),
  startDate: z
    .string()
    .optional()
    .describe('Filter emails received on or after this date (ISO 8601)'),
  endDate: z
    .string()
    .optional()
    .describe('Filter emails received on or before this date (ISO 8601)'),
  folder: z
    .string()
    .optional()
    .describe('Mail folder name or well-known name (e.g. "inbox", "sentitems", "drafts")'),
  top: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of emails to return (1-100)'),
  mailbox: mailboxField,
};

export const ReadEmailSchema = {
  messageId: z.string().describe('The ID of the email message'),
  mailbox: mailboxField,
};

export const SendEmailSchema = {
  to: z.array(z.string()).describe('List of recipient email addresses'),
  subject: z.string().describe('Email subject'),
  body: z.string().describe('Email body content'),
  cc: z.array(z.string()).optional().describe('CC recipient email addresses'),
  bcc: z.array(z.string()).optional().describe('BCC recipient email addresses'),
  contentType: z
    .enum(['text', 'html'])
    .optional()
    .default('text')
    .describe('Body content type (default: text)'),
  mailbox: mailboxField,
};

export const FlagEmailSchema = {
  messageId: z.string().describe('The ID of the email message'),
  flagStatus: z
    .enum(['flagged', 'complete', 'notFlagged'])
    .describe('Flag status to set on the message'),
  mailbox: mailboxField,
};

export const MoveEmailSchema = {
  messageId: z.string().describe('The ID of the email message to move'),
  destinationFolderId: z
    .string()
    .describe('ID or well-known folder name of the destination folder'),
  mailbox: mailboxField,
};

// ---------------------------------------------------------------------------
// New tool schemas
// ---------------------------------------------------------------------------

export const ReplyEmailSchema = {
  messageId: z.string().describe('The ID of the email message to reply to'),
  body: z.string().describe('Reply body content'),
  contentType: z
    .enum(['text', 'html'])
    .optional()
    .default('text')
    .describe('Body content type (default: text)'),
  replyAll: z
    .boolean()
    .optional()
    .default(false)
    .describe('If true, reply to all recipients; if false (default), reply only to sender'),
  mailbox: mailboxField,
};

export const DeleteEmailSchema = {
  messageId: z.string().describe('The ID of the email message to delete'),
  permanent: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If false (default), moves to Deleted Items (recoverable). If true, permanently deletes (unrecoverable).',
    ),
  mailbox: mailboxField,
};

export const EnsureFolderSchema = {
  displayName: z.string().min(1).describe('Display name of the mail folder to get or create'),
  mailbox: mailboxField,
};

export const MarkReadSchema = {
  messageId: z.string().describe('The ID of the email message'),
  isRead: z
    .boolean()
    .optional()
    .default(true)
    .describe('True to mark as read (default), false to mark as unread'),
  mailbox: mailboxField,
};
