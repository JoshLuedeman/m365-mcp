# ADR-001: M365 MCP Server — Architecture & Module Plan

**Status:** Proposed  
**Date:** 2026-05-20  
**Deciders:** Josh Luedeman  
**Repo (planned):** `m365-mcp` (npm: `m365-mcp`)

---

## Context

The Anthropic M365 connector covers mail, calendar, Teams, and SharePoint well, but doesn't expose Microsoft To Do or Planner. Rather than building a narrow Tasks-only patch, we're building a complete, self-contained M365 MCP server in TypeScript/Node that:

- Wraps the Microsoft Graph API with a clean MCP tool surface
- Is distributable as an npm package (`npx m365-mcp`)
- Can be packaged as a Cowork plugin for one-click install
- Serves as a learning project for Node/TypeScript and Claude Code workflows
- Fills a real gap — no polished open-source M365 MCP server exists today

**Constraints:**
- TypeScript (not plain JS) — type safety matters for a distributed package
- Node.js runtime
- Must work with Claude Desktop, Claude Code, and Cowork
- Auth must be user-friendly for non-developers (device code flow, not client secrets)
- Single Azure AD app registration per user

---

## Decision

Build a modular TypeScript MCP server using stdio transport, organized by Graph API domain, with MSAL device code flow auth and file-based token caching. Ship as an npm package. Wrap as a Cowork plugin in a follow-on step.

---

## Options Considered

### Option A: Custom Tasks-only MCP (additive to existing connector)

| Dimension | Assessment |
|-----------|------------|
| Scope | Low — just To Do + Planner |
| Build time | 1–2 days |
| Distribution value | Low — requires existing connector too |
| Learning value | Low — narrow surface area |
| Maintenance | Low |

**Pros:** Fast to ship, minimal auth surface  
**Cons:** Not distributable standalone, doesn't help others, limited Claude Code practice

### Option B: Full M365 MCP Server (chosen)

| Dimension | Assessment |
|-----------|------------|
| Scope | Medium — Mail, Calendar, Tasks, Contacts v1; Planner, Teams, SharePoint v2 |
| Build time | 1–2 weekends for v1 |
| Distribution value | High — standalone, no other connectors needed |
| Learning value | High — TypeScript, MCP SDK, MSAL, Graph API patterns |
| Maintenance | Medium — Graph API is stable, MSAL handles auth complexity |

**Pros:** Standalone value, publishable to npm, real learning surface, community contribution  
**Cons:** More upfront work, needs careful scope management to avoid sprawl

---

## Tech Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Language | TypeScript (strict mode) | Type safety, MCP SDK is TS-first, better DX for contributors |
| MCP SDK | `@modelcontextprotocol/sdk` | Official SDK, handles stdio transport and tool registration |
| Auth | `@azure/msal-node` | Microsoft-official, handles token refresh, supports device code flow |
| Graph client | `@microsoft/microsoft-graph-client` | Official client, handles pagination, retries, and base URL |
| Graph types | `@microsoft/microsoft-graph-types` | Full TypeScript types for all Graph API responses |
| Input validation | `zod` | Tool parameter schemas, runtime validation, good MCP SDK integration |
| Build tool | `tsup` | Fast, zero-config TS bundler, produces clean CJS + ESM output |
| Dev runner | `tsx` | Run TS directly in dev without compile step |
| Linter | `eslint` + `@typescript-eslint` | Standard TS linting |
| Package manager | `npm` (or `pnpm`) | Widest compatibility for distributed packages |

---

## Project Structure

```
m365-mcp/
├── src/
│   ├── index.ts                  # Entry point — creates MCP server, registers all tools
│   ├── server.ts                 # MCP server factory and stdio transport setup
│   │
│   ├── auth/
│   │   ├── msal-client.ts        # MSAL PublicClientApplication setup
│   │   ├── device-code-flow.ts   # Interactive device code auth + token acquisition
│   │   ├── token-cache.ts        # File-based persistent token cache
│   │   └── scopes.ts             # Scope constants per domain
│   │
│   ├── graph/
│   │   └── client.ts             # Graph client factory (injects auth token)
│   │
│   ├── tools/
│   │   ├── mail/
│   │   │   ├── index.ts          # Registers mail tools with the MCP server
│   │   │   ├── handlers.ts       # Graph API calls for each tool
│   │   │   └── schemas.ts        # Zod schemas for tool inputs
│   │   ├── calendar/
│   │   │   └── (same pattern)
│   │   ├── tasks/
│   │   │   └── (same pattern)
│   │   └── contacts/
│   │       └── (same pattern)
│   │
│   └── utils/
│       ├── errors.ts             # Graph error parsing + user-friendly messages
│       ├── pagination.ts         # Handle @odata.nextLink pagination
│       └── formatting.ts        # Consistent response shaping for MCP
│
├── dist/                         # tsup build output (gitignored)
├── .token-cache/                 # Runtime token cache (gitignored)
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

---

## Authentication Design

**Flow:** MSAL device code — user runs `npx m365-mcp auth`, gets a code, opens a browser, signs in once. Token cached to disk. Subsequent runs use the cached refresh token silently.

**Token cache location:** `~/.config/m365-mcp/token-cache.json`  
**Cache implementation:** MSAL's `ICachePlugin` interface with file read/write  
**Scope strategy:** Request all needed scopes at auth time (not per-tool) to avoid repeated consent prompts

**Required Graph API scopes (v1):**
```
Mail.ReadWrite
Mail.Send
Calendars.ReadWrite
Tasks.ReadWrite
Contacts.ReadWrite
offline_access
User.Read
```

**Azure AD app setup (user-facing):**
1. Register app at portal.azure.com → Azure Active Directory → App registrations
2. Set as "Public client / native" (no client secret needed for device code)
3. Add Mobile and desktop redirect URI: `https://login.microsoftonline.com/common/oauth2/nativeclient`
4. Grant the scopes above (delegated permissions, user consent)
5. Copy the Application (client) ID into config

**Config:** Environment variable `M365_MCP_CLIENT_ID` or a local `.m365-mcp.json` config file.

---

## V1 Tool Surface (22 tools)

### Mail (6 tools)
| Tool | Description |
|------|-------------|
| `search_emails` | Search by query, sender, date range, folder. Returns metadata. |
| `read_email` | Get full email body by ID |
| `send_email` | Compose and send with to/cc/bcc/attachments |
| `flag_email` | Flag or unflag a message |
| `list_mail_folders` | List all mail folders |
| `move_email` | Move message to a folder |

### Calendar (5 tools)
| Tool | Description |
|------|-------------|
| `search_events` | Search by query, date range, attendee |
| `get_event` | Get full event details by ID |
| `create_event` | Create event with attendees, location, Teams link |
| `update_event` | Update subject, time, attendees, body |
| `find_availability` | Free/busy lookup for one or more people |

### Tasks / Microsoft To Do (7 tools)
| Tool | Description |
|------|-------------|
| `list_task_lists` | Get all To Do task lists |
| `list_tasks` | Get tasks from a specific list with filters |
| `get_task` | Get full task details including body, due date, reminders |
| `create_task` | Create task in a list |
| `update_task` | Update title, body, due date, importance |
| `complete_task` | Mark task as completed |
| `delete_task` | Delete a task |

### Contacts (4 tools)
| Tool | Description |
|------|-------------|
| `search_contacts` | Search personal contacts + directory |
| `get_contact` | Get contact details by ID |
| `create_contact` | Add to personal contacts |
| `update_contact` | Update contact fields |

---

## V2 Tool Surface (future)

| Domain | Planned tools |
|--------|--------------|
| **Planner** | list_plans, list_buckets, list_planner_tasks, create_planner_task, update_planner_task, complete_planner_task |
| **Teams** | search_chats, read_chat_message, send_chat_message, list_channels, read_channel_message |
| **SharePoint / OneDrive** | search_files, read_file, list_folder, upload_file, share_file |

---

## Distribution Strategy

### Phase 1 — npm package
```bash
npx m365-mcp          # run directly
npm install -g m365-mcp  # or install globally
```

Claude Desktop config (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "m365": {
      "command": "npx",
      "args": ["m365-mcp"],
      "env": { "M365_MCP_CLIENT_ID": "your-client-id" }
    }
  }
}
```

### Phase 2 — Cowork plugin
- Wraps the npm package as an MCP server definition in a `.plugin` file
- Users click "Add" in Cowork, enter their client ID, done
- No manual config file editing

### Phase 3 — Community
- GitHub repo with good README and setup guide
- Submit to MCP server directories / awesome-mcp lists
- Blog post / LinkedIn content (ties into CXO Marketing project)

---

## Trade-off Analysis

**stdio vs HTTP transport:** stdio is correct for local use with Claude Desktop/Code/Cowork. HTTP/SSE would enable hosted/multi-user scenarios but adds auth complexity and hosting burden. Start with stdio, add HTTP as an optional mode in v2.

**Official Graph SDK vs raw fetch:** The Graph SDK handles base URL, auth token injection, pagination helpers, and retry logic. Raw fetch is simpler to understand but requires reimplementing all of that. SDK wins for a distributed package.

**Monorepo vs single package:** Single package for v1. If v2 domains grow large, consider splitting into `m365-mcp-core` + domain packages — but premature for now.

**Per-tool scopes vs upfront consent:** Requesting all scopes at auth time is better UX (one consent prompt vs many). The tradeoff is users grant more than they might immediately use, but this is standard practice for productivity apps.

---

## Consequences

**Easier after this decision:**
- Claude can manage your To Do lists, Planner tasks, calendar, and mail from a single self-hosted server
- Any Claude interface (Desktop, Code, Cowork) can use it with the same config
- You own the code — can add custom tools whenever needed
- Publishable project that builds your technical brand

**Harder / things to watch:**
- Azure AD app setup is a friction point for non-technical users — README needs to be excellent
- Token cache security: the cached token file should have restricted file permissions (chmod 600)
- Rate limiting: Graph API has per-user throttling — need exponential backoff in error handling
- Breaking changes: Graph API is versioned (`/v1.0`) and stable, but watch for deprecations

---

## Action Items

### Setup
- [ ] `npm create` new TypeScript project, configure `tsconfig.json` (strict: true, target: ES2022, module: NodeNext)
- [ ] Install dependencies: `@modelcontextprotocol/sdk`, `@azure/msal-node`, `@microsoft/microsoft-graph-client`, `@microsoft/microsoft-graph-types`, `zod`, `tsup`, `tsx`
- [ ] Configure `tsup.config.ts` for CJS + ESM dual output
- [ ] Register Azure AD app in your tenant, note the client ID

### Auth module (build first)
- [ ] Implement `msal-client.ts` — create `PublicClientApplication` from client ID + tenant
- [ ] Implement `token-cache.ts` — file-based MSAL cache plugin
- [ ] Implement `device-code-flow.ts` — interactive auth + silent token refresh
- [ ] Wire up `auth` CLI command: `npx m365-mcp auth`
- [ ] Test end-to-end: authenticate, cache token, re-run silently

### Graph client
- [ ] Implement `graph/client.ts` — factory that returns authenticated Graph client

### Tools (implement in this order — Tasks first since that's the gap)
- [ ] **Tasks module** — 7 tools against `/me/todo/lists`
- [ ] **Calendar module** — 5 tools against `/me/calendar`
- [ ] **Mail module** — 6 tools against `/me/messages`
- [ ] **Contacts module** — 4 tools against `/me/contacts`

### Server wiring
- [ ] Implement `server.ts` — MCP server, register all tool modules
- [ ] Implement `index.ts` — entry point, parse args (auth vs serve)
- [ ] Add `bin` entry in `package.json` so `npx m365-mcp` works

### Polish
- [ ] Error handling utility — translate Graph API errors to useful MCP responses
- [ ] Pagination utility — handle `@odata.nextLink` transparently
- [ ] README with Azure AD setup walkthrough + Claude Desktop config snippet
- [ ] Publish to npm

### Follow-on
- [ ] Package as Cowork plugin
- [ ] Add Planner tools (v2)
- [ ] Blog post / LinkedIn post (CXO Marketing tie-in)
