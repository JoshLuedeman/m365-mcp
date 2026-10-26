import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  ListJoinedTeamsSchema,
  ListChannelsSchema,
  ListChannelMessagesSchema,
  ListChatsSchema,
  ListChatMessagesSchema,
} from './schemas.js';
import {
  handleListJoinedTeams,
  handleListChannels,
  handleListChannelMessages,
  handleListChats,
  handleListChatMessages,
} from './handlers.js';

// Teams tools in this category are READ-ONLY by design — see schemas.ts for
// why no send_message tool exists here.

export function register(server: McpServer): void {
  server.tool(
    'list_joined_teams',
    'List Microsoft Teams (Teams-enabled Microsoft 365 groups) visible to this app',
    ListJoinedTeamsSchema,
    async ({ top }) => handleListJoinedTeams(top),
  );

  server.tool(
    'list_channels',
    'List channels within a specific team',
    ListChannelsSchema,
    async ({ teamId }) => handleListChannels(teamId),
  );

  server.tool(
    'list_channel_messages',
    'List recent messages in a team channel (read-only)',
    ListChannelMessagesSchema,
    async ({ teamId, channelId, top }) => handleListChannelMessages(teamId, channelId, top),
  );

  server.tool(
    'list_chats',
    'List 1:1 and group chats for a mailbox',
    ListChatsSchema,
    async ({ mailbox }) => handleListChats(mailbox),
  );

  server.tool(
    'list_chat_messages',
    'List recent messages in a chat (read-only)',
    ListChatMessagesSchema,
    async ({ chatId, top, mailbox }) => handleListChatMessages(chatId, top, mailbox),
  );
}
