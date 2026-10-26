import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Prevent real MSAL client initialization during module load
vi.mock('../src/auth/msal-client.js', () => ({
  getMsalClient: vi.fn(),
}));

// Mock client credentials flow to avoid env var requirements during server creation
vi.mock('../src/auth/client-credentials-flow.js', () => ({
  acquireAppToken: vi.fn(),
  resetClientCredentialState: vi.fn(),
}));

describe('createServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers all 26 tools', async () => {
    const registeredTools: string[] = [];

    vi.spyOn(McpServer.prototype, 'tool').mockImplementation(
      (name: string, ..._args: unknown[]) => {
        registeredTools.push(name);
        return {} as ReturnType<McpServer['tool']>;
      },
    );

    const { createServer } = await import('../src/server.js');
    createServer();

    const expected = [
      // Mail
      'search_emails',
      'read_email',
      'send_email',
      'flag_email',
      'list_mail_folders',
      'move_email',
      'reply_email',
      'delete_email',
      'mark_read',
      'ensure_folder',
      // Calendar
      'search_events',
      'get_event',
      'create_event',
      'update_event',
      'find_availability',
      // Tasks
      'list_task_lists',
      'list_tasks',
      'get_task',
      'create_task',
      'update_task',
      'complete_task',
      'delete_task',
      // Contacts
      'search_contacts',
      'get_contact',
      'create_contact',
      'update_contact',
      // OneDrive
      'list_files',
      'get_file',
      'search_files',
      'read_file_content',
      'create_folder',
      'delete_file',
      'move_file',
      'create_sharing_link',
      // Teams (read-only)
      'list_joined_teams',
      'list_channels',
      'list_channel_messages',
      'list_chats',
      'list_chat_messages',
      // Users
      'list_users',
      'search_users',
      'get_user',
      // Planner (prefixed to avoid colliding with Tasks' list_tasks/get_task/etc.)
      'list_plans',
      'list_buckets',
      'list_plan_tasks',
      'get_plan_task',
      'get_plan_task_details',
      'create_plan_task',
      'update_plan_task',
    ];

    expect(registeredTools).toHaveLength(49);
    for (const name of expected) {
      expect(registeredTools).toContain(name);
    }

    // Confirm there are no duplicate tool *** across categories — this is
    // exactly the class of bug (Planner/Tasks name collision) that crashed
    // the real server at startup before being caught; a stale test that
    // merely asserts length+membership would NOT have caught the collision
    // itself, since duplicates still satisfy both of those. This explicit
    // uniqueness check is the actual regression guard.
    const uniqueNames = new Set(registeredTools);
    expect(uniqueNames.size).toBe(registeredTools.length);
  });
});
