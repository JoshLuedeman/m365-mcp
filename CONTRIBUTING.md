# Contributing

## Prerequisites

- Node >= 18
- npm
- TypeScript — you should be comfortable reading and writing typed TypeScript; the project uses strict mode with no `any`

## Setup

```bash
git clone https://github.com/joshluedeman/m365-mcp.git
cd m365-mcp
npm install
npm run dev
```

`npm run dev` runs the server directly via `tsx` without a build step, which is the fastest iteration loop.

## Dev Commands

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Run the server with `tsx` (no compile step) |
| `npm run build` | Compile to `dist/` via `tsup` |
| `npm run typecheck` | Type-check without emitting (`tsc --noEmit`) |
| `npm run lint` | Lint `src/` with ESLint |
| `npm test` | Run tests |

All four checks (typecheck, lint, tests, build) must pass before a PR is merged.

## Project Structure

```
src/
  auth/           MSAL client setup, device code flow, token cache plugin, scopes
  graph/          Microsoft Graph client factory
  tools/
    mail/         Mail tools — schemas.ts, handlers.ts, index.ts
    calendar/     Calendar tools
    tasks/        Microsoft To Do tools
    contacts/     Contacts tools
  utils/          Shared helpers: error parsing, response formatting, pagination
  setup/          Interactive CLI installer (npx m365-mcp setup)
  server.ts       MCP server construction — registers all tool domains
  index.ts        Entry point — starts the server or runs setup
```

Each tool domain (`mail`, `calendar`, `tasks`, `contacts`) is self-contained: it owns its Zod schemas, its handler functions, and an `index.ts` that exports the tool list for registration.

## Adding a New Tool to an Existing Domain

1. **Define the input schema** in `src/tools/<domain>/schemas.ts` using Zod. Export a named schema (e.g., `MyToolSchema`) and its inferred input type.

2. **Write the handler** in `src/tools/<domain>/handlers.ts`. Every handler follows the same pattern:

   ```typescript
   export async function handleMyTool(params: MyToolParams): Promise<CallToolResult> {
     try {
       const token = await acquireToken();
       const client = getGraphClient(token);
       // ... Graph API call ...
       return formatResponse(result);
     } catch (err) {
       return formatError(parseGraphError(err));
     }
   }
   ```

   Never short-circuit this pattern. `acquireToken` handles token refresh and the device code prompt; `parseGraphError` normalises Graph API errors into a consistent shape.

3. **Register the tool** in `src/tools/<domain>/index.ts`. Add an entry to the tool list with the tool name, description, input schema (`.shape` for the JSON Schema adapter), and a call to your handler.

## Adding a New Domain

1. Create `src/tools/<domain>/schemas.ts`, `handlers.ts`, and `index.ts` following the pattern of an existing domain.
2. Import and register the domain's tool list in `src/server.ts`.

That's it — the MCP server iterates the registered tools at startup.

## PR Expectations

- **Typecheck, lint, and tests must pass.** Run them locally before opening a PR; CI will block on failures.
- **Conventional commit messages preferred**: `feat:`, `fix:`, `docs:`, `chore:`, etc. Not enforced mechanically, but it makes the CHANGELOG easier to maintain.
- **One concern per PR.** Split unrelated changes.
- **Update CHANGELOG.md** under `[Unreleased]` for any user-facing change (new tool, changed behavior, bug fix).

## Code Style

- TypeScript strict mode — `noImplicitAny`, `strictNullChecks`, etc. are all on.
- No `any`. Use `unknown` and narrow it, or model the type properly.
- Explicit return types on all exported functions.
- Comments explain *why*, not *what*. If the what isn't obvious, the code needs to be clearer, not the comment.
- No barrel re-exports that obscure where things live.
