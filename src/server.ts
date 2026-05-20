import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { register as registerTasks } from './tools/tasks/index.js';
import { register as registerCalendar } from './tools/calendar/index.js';
import { register as registerMail } from './tools/mail/index.js';
import { register as registerContacts } from './tools/contacts/index.js';
import { VERSION } from './version.js';

/**
 * Creates and configures the MCP server with all domain tool registrations.
 * Returns the server instance ready to be connected to a transport.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'm365-mcp',
    version: VERSION,
  });

  registerTasks(server);
  registerCalendar(server);
  registerMail(server);
  registerContacts(server);

  return server;
}
