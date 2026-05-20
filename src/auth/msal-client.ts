import fs from 'fs';
import path from 'path';
import os from 'os';
import { PublicClientApplication } from '@azure/msal-node';
import type { Configuration } from '@azure/msal-node';
import { tokenCachePlugin } from './token-cache.js';
import { DEFAULT_CLIENT_ID } from './app-config.js';

// Priority 2: ~/.config/m365-mcp/config.json (written by `setup` command)
const USER_CONFIG_PATH = path.join(os.homedir(), '.config', 'm365-mcp', 'config.json');
// Priority 3: legacy per-directory config
const LOCAL_CONFIG_PATH = path.join(process.cwd(), '.m365-mcp.json');

interface M365Config {
  clientId: string;
  tenantId?: string;
}

function readConfigFile(filePath: string): M365Config | null {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as M365Config;
    }
  } catch {
    // unreadable or malformed — treat as missing
  }
  return null;
}

function loadClientId(): string {
  // 1. Environment variable
  const envClientId = process.env['M365_MCP_CLIENT_ID'];
  if (envClientId) {
    return envClientId;
  }

  // 2. ~/.config/m365-mcp/config.json (written by `setup` command)
  const userConfig = readConfigFile(USER_CONFIG_PATH);
  if (userConfig?.clientId) {
    return userConfig.clientId;
  }

  // 3. .m365-mcp.json in cwd (legacy fallback)
  const localConfig = readConfigFile(LOCAL_CONFIG_PATH);
  if (localConfig?.clientId) {
    return localConfig.clientId;
  }

  // 4. Shared publisher-registered app ID baked into the package
  if (DEFAULT_CLIENT_ID) {
    return DEFAULT_CLIENT_ID;
  }

  throw new Error('No client ID configured. Run "npx m365-mcp setup" to get started.');
}

function loadTenantId(): string {
  const envTenantId = process.env['M365_MCP_TENANT_ID'];
  if (envTenantId) {
    return envTenantId;
  }

  // 2. ~/.config/m365-mcp/config.json
  const userConfig = readConfigFile(USER_CONFIG_PATH);
  if (userConfig?.tenantId) {
    return userConfig.tenantId;
  }

  // 3. .m365-mcp.json in cwd (legacy fallback)
  const localConfig = readConfigFile(LOCAL_CONFIG_PATH);
  if (localConfig?.tenantId) {
    return localConfig.tenantId;
  }

  // Use common endpoint for multi-tenant / personal accounts
  return 'common';
}

let _msalClient: PublicClientApplication | undefined;

export function getMsalClient(): PublicClientApplication {
  if (_msalClient) {
    return _msalClient;
  }

  const clientId = loadClientId();
  const tenantId = loadTenantId();

  const msalConfig: Configuration = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
    cache: {
      cachePlugin: tokenCachePlugin,
    },
    system: {
      loggerOptions: {
        loggerCallback: (_level, message, containsPii) => {
          if (!containsPii) {
            process.stderr.write(`[msal] ${message}\n`);
          }
        },
        piiLoggingEnabled: false,
      },
    },
  };

  _msalClient = new PublicClientApplication(msalConfig);
  return _msalClient;
}
