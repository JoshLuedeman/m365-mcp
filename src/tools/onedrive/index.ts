import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ListFilesSchema,
  GetFileSchema,
  SearchFilesSchema,
  ReadFileContentSchema,
  CreateFolderSchema,
  DeleteFileSchema,
  MoveFileSchema,
  CreateSharingLinkSchema,
} from './schemas.js';
import {
  handleListFiles,
  handleGetFile,
  handleSearchFiles,
  handleReadFileContent,
  handleCreateFolder,
  handleDeleteFile,
  handleMoveFile,
  handleCreateSharingLink,
} from './handlers.js';

export function register(server: McpServer): void {
  server.tool(
    'list_files',
    'List files and folders in OneDrive, optionally within a specific folder',
    ListFilesSchema,
    async ({ folderId, mailbox }) => handleListFiles(folderId, mailbox),
  );

  server.tool(
    'get_file',
    'Get metadata for a single file or folder by ID',
    GetFileSchema,
    async ({ itemId, mailbox }) => handleGetFile(itemId, mailbox),
  );

  server.tool(
    'search_files',
    'Search OneDrive files and folders by name or content',
    SearchFilesSchema,
    async ({ query, top, mailbox }) => handleSearchFiles(query, top, mailbox),
  );

  server.tool(
    'read_file_content',
    'Read the text content of a file (best for text-based formats; binary formats like docx/xlsx/pdf will not decode cleanly)',
    ReadFileContentSchema,
    async ({ itemId, mailbox }) => handleReadFileContent(itemId, mailbox),
  );

  server.tool(
    'create_folder',
    'Create a new folder in OneDrive, optionally within a parent folder',
    CreateFolderSchema,
    async ({ name, parentFolderId, mailbox }) => handleCreateFolder(name, parentFolderId, mailbox),
  );

  server.tool(
    'delete_file',
    'Delete a file or folder from OneDrive',
    DeleteFileSchema,
    async ({ itemId, mailbox }) => handleDeleteFile(itemId, mailbox),
  );

  server.tool(
    'move_file',
    'Move a file or folder to a different parent folder',
    MoveFileSchema,
    async ({ itemId, destinationFolderId, mailbox }) => handleMoveFile(itemId, destinationFolderId, mailbox),
  );

  server.tool(
    'create_sharing_link',
    'Create a sharing link for a file or folder',
    CreateSharingLinkSchema,
    async (params) => handleCreateSharingLink(params),
  );
}
