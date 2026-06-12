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
    ];

    expect(registeredTools).toHaveLength(26);
    for (const name of expected) {
      expect(registeredTools).toContain(name);
    }
  });
});
