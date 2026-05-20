# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`m365-mcp` is a TypeScript MCP server that wraps the Microsoft Graph API and ships as an npm package (`npx @joshluedeman/m365-mcp`). It provides Claude Desktop, Claude Code, and Cowork with tools for Mail, Calendar, Tasks (Microsoft To Do), and Contacts — filling the gap left by the Anthropic M365 connector (no To Do/Planner support). See `docs/adr/ADR-001-m365-mcp-server.md` for full rationale.

## Commands

```bash
# Development
npm run dev          # run server via tsx (no compile step)
npm run build        # tsup — produces CJS + ESM in dist/
npm run lint         # eslint with @typescript-eslint
npm run typecheck    # tsc --noEmit

# First-time setup (interactive installer)
npx @joshluedeman/m365-mcp setup   # creates Azure AD app (via CLI or manual), writes config, runs auth

# Auth only (if already configured)
npx @joshluedeman/m365-mcp auth    # device code login → ~/.config/m365-mcp/token-cache.json

# Run MCP server (stdio — for Claude Desktop / Claude Code)
npx @joshluedeman/m365-mcp
```

Tests use **Vitest** (`tests/` directory, 48 tests across 6 files):
- `tests/utils/` — unit tests for errors, formatting, pagination
- `tests/setup/config-writer.test.ts` — config read/write with temp dirs
- `tests/tools/schemas.test.ts` — Zod schema validation (20 cases)
- `tests/server.test.ts` — integration test: spies on `McpServer.prototype.tool` and verifies all 22 tools are registered

## Architecture

**Transport:** stdio only (v1). The MCP server receives JSON-RPC over stdin/stdout — no HTTP layer. This is what Claude Desktop and Claude Code expect for local servers.

**Auth:** MSAL device code flow via `@azure/msal-node`. All scopes requested upfront at `auth` time (one consent prompt). Tokens cached to `~/.config/m365-mcp/token-cache.json` via MSAL's `ICachePlugin`. Silent refresh on every server start; interactive re-auth only on refresh token expiry.

**Shared app ID:** The package ships with a single publisher-registered Azure AD app (`src/auth/app-config.ts` → `DEFAULT_CLIENT_ID`). End users need no app registration — they just sign in. Replace `PLACEHOLDER_CLIENT_ID` with the real app ID before publishing.

**Config resolution order** (`src/auth/msal-client.ts`):
1. `M365_MCP_CLIENT_ID` env var ← enterprise override
2. `~/.config/m365-mcp/config.json` ← written by `config-writer.ts` for enterprise use
3. `.m365-mcp.json` in `process.cwd()` ← legacy fallback
4. `DEFAULT_CLIENT_ID` from `app-config.ts` ← default for all users

**Setup command** (`src/setup/index.ts`): `npx @joshluedeman/m365-mcp setup` prints a brief banner + permission summary, checks for an existing token cache, optionally prompts to re-authenticate, then calls `runAuthCommand()`. No app registration steps — the shared client ID handles everything. All output to stderr; `/dev/tty` for prompts to avoid consuming MCP stdio.

**Graph client:** `@microsoft/microsoft-graph-client` (official SDK — handles auth injection, base URL, retries). Types from `@microsoft/microsoft-graph-types`. All Graph calls go through `/v1.0/`.

**Tool registration pattern:** Each domain (`mail`, `calendar`, `tasks`, `contacts`) is a self-contained module under `src/tools/<domain>/`:
- `schemas.ts` — Zod schemas for input validation (used by MCP SDK for parameter enforcement)
- `handlers.ts` — Graph API calls; each handler returns a shaped response via `src/utils/formatting.ts`
- `index.ts` — registers the domain's tools against the MCP server instance

`src/server.ts` creates the MCP server and imports all domain `index.ts` files. `src/index.ts` is the CLI entry point — dispatches to `auth` command or starts the server.

**Pagination:** `src/utils/pagination.ts` handles `@odata.nextLink` transparently — callers don't loop manually.

**Error handling:** `src/utils/errors.ts` translates Graph API error codes to user-readable MCP error responses. Graph throttling (429) must use exponential backoff here.

## Key Constraints & Build Notes

- TypeScript strict mode, ES2022, module NodeNext (`"type": "module"` in package.json)
- `tsup` builds dual CJS + ESM; **`bin` points to `dist/index.cjs`** (not `.js`) — with `"type": "module"`, Node treats `.js` as ESM which breaks `npx` bin resolution in some environments
- DTS generation is **disabled** in `tsup.config.ts` — tsup v8 injects `baseUrl: "."` which TypeScript 6 rejects as a deprecated option. This is a CLI binary, not a library, so DTS has no value.
- Token cache: `~/.config/m365-mcp/token-cache.json`, written with `mode: 0o600` + `chmodSync` on every write
- All Graph scopes requested at auth time: `Mail.ReadWrite Mail.Send Calendars.ReadWrite Tasks.ReadWrite Contacts.ReadWrite offline_access User.Read`
- Auth output (device code URL, tokens, errors) goes to **stderr only** — stdout is reserved for MCP JSON-RPC
- V1 tool count: 22 tools (Mail×6, Calendar×5, Tasks×7, Contacts×4)
- V2 (future): Planner, Teams, SharePoint/OneDrive — do not add these to v1

## V1 Tool Surface

| Domain | Tools |
|--------|-------|
| Mail | `search_emails`, `read_email`, `send_email`, `flag_email`, `list_mail_folders`, `move_email` |
| Calendar | `search_events`, `get_event`, `create_event`, `update_event`, `find_availability` |
| Tasks | `list_task_lists`, `list_tasks`, `get_task`, `create_task`, `update_task`, `complete_task`, `delete_task` |
| Contacts | `search_contacts`, `get_contact`, `create_contact`, `update_contact` |

## Current Status

Repository is public-ready. Remaining work before npm publish:
- [ ] Complete Microsoft publisher verification (needs MPN/Partner Network ID — see memory)
- [ ] End-to-end auth smoke test with a real user signing in via `npx @joshluedeman/m365-mcp setup`
- [ ] `git init` + push to `https://github.com/joshluedeman/m365-mcp`
- [ ] npm publish
- [ ] V2: Planner, Teams, SharePoint tools
