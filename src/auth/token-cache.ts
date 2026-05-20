import fs from 'fs';
import path from 'path';
import os from 'os';
import type { ICachePlugin, TokenCacheContext } from '@azure/msal-node';

const CACHE_DIR = path.join(os.homedir(), '.config', 'm365-mcp');
const CACHE_PATH = path.join(CACHE_DIR, 'token-cache.json');

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export const tokenCachePlugin: ICachePlugin = {
  async beforeCacheAccess(tokenCacheContext: TokenCacheContext): Promise<void> {
    try {
      if (fs.existsSync(CACHE_PATH)) {
        const data = fs.readFileSync(CACHE_PATH, 'utf-8');
        tokenCacheContext.tokenCache.deserialize(data);
      }
    } catch (err) {
      // Cache file unreadable or corrupt — start fresh
      process.stderr.write(`[m365-mcp] token cache read error (starting fresh): ${String(err)}\n`);
    }
  },

  async afterCacheAccess(tokenCacheContext: TokenCacheContext): Promise<void> {
    if (!tokenCacheContext.cacheHasChanged) {
      return;
    }
    try {
      ensureCacheDir();
      const data = tokenCacheContext.tokenCache.serialize();
      fs.writeFileSync(CACHE_PATH, data, { encoding: 'utf-8', mode: 0o600 });
      // Enforce 600 even if file already existed with different permissions
      fs.chmodSync(CACHE_PATH, 0o600);
    } catch (err) {
      process.stderr.write(`[m365-mcp] token cache write error: ${String(err)}\n`);
    }
  },
};

export { CACHE_PATH };
