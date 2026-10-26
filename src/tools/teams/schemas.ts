import { z } from 'zod';

const mailboxField = z
  .string()
  .optional()
  .describe(
    'Mailbox UPN or object ID (e.g. user@domain.com). Required for client_credentials auth; omit for device_code auth.',
  );

// NOTE: Teams tools in this category are READ-ONLY by design. Microsoft Graph
// has no viable Application permission for sending Teams channel or chat
// messages (only Teamwork.Migrate.All exists, which is migration-scoped, not
// a general-purpose send capability) — confirmed directly against Microsoft's
// own permissions tables. Do not add a send_message tool here; it cannot be
// built against this auth model.

export const ListJoinedTeamsSchema = {
  top: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of teams to return (1-100)'),
};

export const ListChannelsSchema = {
  teamId: z.string().describe('The ID of the team (Microsoft 365 group with Teams enabled)'),
};

export const ListChannelMessagesSchema = {
  teamId: z.string().describe('The ID of the team'),
  channelId: z.string().describe('The ID of the channel'),
  top: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of messages to return (1-100)'),
};

export const ListChatsSchema = {
  mailbox: mailboxField,
};

export const ListChatMessagesSchema = {
  chatId: z.string().describe('The ID of the chat'),
  top: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of messages to return (1-100)'),
  mailbox: mailboxField,
};
