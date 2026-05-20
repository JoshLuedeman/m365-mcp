import fs from 'fs';
import path from 'path';
import os from 'os';
import { runAuthCommand } from '../auth/device-code-flow.js';
import { confirm } from './prompts.js';

const TOKEN_CACHE_PATH = path.join(os.homedir(), '.config', 'm365-mcp', 'token-cache.json');

function stderr(msg: string): void {
  process.stderr.write(msg + '\n');
}

export async function runSetupCommand(): Promise<void> {
  stderr('m365-mcp — Microsoft 365 for Claude');
  stderr('');
  stderr('This will grant access to:');
  stderr('  • Mail (read, send)');
  stderr('  • Calendar (read, create, update)');
  stderr('  • Tasks (read, create, update, delete)');
  stderr('  • Contacts (read, create, update)');
  stderr('');

  const cacheExists = fs.existsSync(TOKEN_CACHE_PATH);
  if (cacheExists) {
    const reauth = await confirm("You're already signed in. Re-authenticate?", false);
    if (!reauth) {
      stderr('Setup cancelled.');
      return;
    }
  }

  await runAuthCommand();
  stderr('Setup complete! Add m365-mcp to your Claude Desktop or Claude Code config to get started.');
}
