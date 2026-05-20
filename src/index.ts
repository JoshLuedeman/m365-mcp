#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { runAuthCommand } from './auth/device-code-flow.js';
import { createServer } from './server.js';

const command = process.argv[2];

async function main(): Promise<void> {
  if (command === 'setup') {
    const { runSetupCommand } = await import('./setup/index.js');
    await runSetupCommand();
    return;
  }

  if (command === 'auth') {
    await runAuthCommand();
    return;
  }

  // Default: start MCP server on stdio transport
  const server = createServer();
  const transport = new StdioServerTransport();

  // Catch unhandled transport errors — never crash the process
  process.on('uncaughtException', (err) => {
    process.stderr.write(`[m365-mcp] Uncaught exception: ${String(err)}\n`);
  });

  process.on('unhandledRejection', (reason) => {
    process.stderr.write(`[m365-mcp] Unhandled rejection: ${String(reason)}\n`);
  });

  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[m365-mcp] Fatal startup error: ${String(err)}\n`);
  process.exit(1);
});
