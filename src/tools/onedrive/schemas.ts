import { z } from 'zod';

const mailboxField = z
  .string()
  .optional()
  .describe(
    'Mailbox UPN or object ID (e.g. user@domain.com). Required for client_credentials auth; omit for device_code auth.',
  );

export const ListFilesSchema = {
  folderId: z
    .string()
    .optional()
    .describe('ID of the folder to list; omit to list the drive root'),
  mailbox: mailboxField,
};

export const GetFileSchema = {
  itemId: z.string().describe('The ID of the file or folder'),
  mailbox: mailboxField,
};

export const SearchFilesSchema = {
  query: z.string().describe('Search query matched against file/folder names and content'),
  top: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of results to return (1-100)'),
  mailbox: mailboxField,
};

export const ReadFileContentSchema = {
  itemId: z.string().describe('The ID of the file to read'),
  mailbox: mailboxField,
};

export const CreateFolderSchema = {
  parentFolderId: z
    .string()
    .optional()
    .describe('ID of the parent folder; omit to create at the drive root'),
  name: z.string().describe('Name of the new folder'),
  mailbox: mailboxField,
};

export const DeleteFileSchema = {
  itemId: z.string().describe('The ID of the file or folder to delete'),
  mailbox: mailboxField,
};

export const MoveFileSchema = {
  itemId: z.string().describe('The ID of the file or folder to move'),
  destinationFolderId: z.string().describe('The ID of the destination folder'),
  mailbox: mailboxField,
};

export const CreateSharingLinkSchema = {
  itemId: z.string().describe('The ID of the file or folder to share'),
  type: z
    .enum(['view', 'edit'])
    .optional()
    .default('view')
    .describe('Link permission level: view (read-only) or edit (default: view)'),
  scope: z
    .enum(['anonymous', 'organization'])
    .optional()
    .default('organization')
    .describe('Link audience: anonymous (anyone with the link) or organization (default: organization)'),
  mailbox: mailboxField,
};
