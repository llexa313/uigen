# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup       # First-time setup: install deps, generate Prisma client, run migrations
npm run dev         # Start dev server with Turbopack (http://localhost:3000)
npm run build       # Production build
npm run lint        # Run ESLint
npm run test        # Run Vitest
npm run db:reset    # Reset SQLite database
```

To run a single test file: `npx vitest run src/path/to/file.test.ts`

## Environment

Copy `.env` and set `ANTHROPIC_API_KEY`. If omitted, the app runs with a mock model that generates static demo components without hitting the API.

## Architecture

UIGen is an AI-powered React component generator with a three-panel layout:

- **Left (35%):** Chat interface — user describes a component, Claude responds with streaming tool calls
- **Right (65%):** Tabbed panel — **Preview** (live iframe) or **Code** (file tree + Monaco editor)

### Request Flow

1. User sends a message → `POST /api/chat` with conversation history + serialized virtual FS
2. `route.ts` prepends the system prompt, calls Claude (`claude-haiku-4-5`) via Vercel AI SDK
3. Claude uses two tools in an agentic loop (up to 40 steps):
   - `str_replace_editor` — create/view/edit files in the virtual FS
   - `file_manager` — file operations (rename, delete, list)
4. Tool calls are streamed back; `onToolCall` in `ChatInterface.tsx` updates `FileSystemContext`
5. Preview re-renders: `jsx-transformer.ts` transpiles JSX with Babel, builds an import map (local files → blob URLs, third-party → esm.sh), and generates a sandboxed iframe HTML

### Key Modules

| Path | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | AI endpoint — model selection, tool registration, streaming |
| `src/lib/file-system.ts` | In-memory virtual FS (never writes to disk); serialize/deserialize for DB |
| `src/lib/transform/jsx-transformer.ts` | Babel JSX → ES modules, import map, iframe HTML generation |
| `src/lib/tools/` | `str-replace.ts` and `file-manager.ts` — tools exposed to Claude |
| `src/lib/prompts/generation.tsx` | System prompt for component generation |
| `src/lib/provider.ts` | Switches between real Anthropic model and mock based on env |
| `src/lib/contexts/` | `chat-context.tsx` and `file-system-context.tsx` — React state |
| `src/actions/` | Next.js server actions for auth and project CRUD |
| `src/lib/auth.ts` | JWT sessions via `jose`, HTTP-only cookies (7-day expiry) |

### Database

Prisma + SQLite (`prisma/dev.db`). Schema defined in `prisma/schema.prisma`. Generated client lives in `src/generated/prisma`.

**Models:**

`User`
- `id` — cuid, primary key
- `email` — unique string
- `password` — bcrypt-hashed string
- `createdAt`, `updatedAt` — timestamps
- `projects` — relation to Project[]

`Project`
- `id` — cuid, primary key
- `name` — string
- `userId` — optional (anonymous projects supported; cascade deletes on user removal)
- `messages` — JSON blob (chat history, default `"[]"`)
- `data` — JSON blob (serialized virtual FS state, default `"{}"`)
- `createdAt`, `updatedAt` — timestamps

### Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).
