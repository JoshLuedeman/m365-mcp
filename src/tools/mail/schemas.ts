import { z } from 'zod';

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
};

export const ReadEmailSchema = {
  messageId: z.string().describe('The ID of the email message'),
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
};

export const FlagEmailSchema = {
  messageId: z.string().describe('The ID of the email message'),
  flagStatus: z
    .enum(['flagged', 'complete', 'notFlagged'])
    .describe('Flag status to set on the message'),
};

export const MoveEmailSchema = {
  messageId: z.string().describe('The ID of the email message to move'),
  destinationFolderId: z
    .string()
    .describe('ID or well-known folder name of the destination folder'),
};
