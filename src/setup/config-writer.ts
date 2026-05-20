import fs from 'fs';
import path from 'path';
import os from 'os';

export interface M365McpConfig {
  clientId: string;
  tenantId?: string;
}

export const CONFIG_DIR = path.join(os.homedir(), '.config', 'm365-mcp');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export function writeConfig(config: M365McpConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  // Enforce 0o600 in case the file already existed with looser permissions
  fs.chmodSync(CONFIG_PATH, 0o600);
}

export function readConfig(): M365McpConfig | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return null;
    }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as M365McpConfig;
    if (!parsed.clientId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
