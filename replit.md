# Jarvis

A personal AI chatbot assistant powered by OpenAI — sleek, intelligent, and conversational with a command-center aesthetic. Built for multi-turn chat with conversation memory and streaming responses.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/jarvis run dev` — run the frontend (port 21662)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-set by Replit AI Integrations

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: OpenAI gpt-5.4 via Replit AI Integrations (no user API key needed)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for all API shapes)
- `lib/db/src/schema/conversations.ts` — conversations table schema
- `lib/db/src/schema/messages.ts` — messages table schema
- `artifacts/api-server/src/routes/openai/index.ts` — all chat API routes
- `artifacts/jarvis/src/` — React frontend
- `lib/integrations-openai-ai-server/` — OpenAI SDK client + utilities
- `lib/integrations-openai-ai-react/` — React hooks for voice/audio (future use)

## Architecture decisions

- Contract-first: OpenAPI spec → codegen → typed React hooks + Zod validators
- Streaming SSE for AI responses: raw fetch + ReadableStream on client (Orval can't generate SSE hooks)
- Conversations persist in PostgreSQL; each conversation holds full message history sent to OpenAI
- Jarvis system prompt baked into the route handler — personality set at the server level
- No user API key required — Replit AI Integrations proxies OpenAI calls and bills to Replit credits

## Product

- Multi-conversation chat: create, select, delete conversations from sidebar
- Streaming AI responses with typewriter effect
- Full message history per conversation (sent as context to OpenAI)
- Command-center dark UI with cyan accents

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- SSE streaming endpoints cannot use generated React Query hooks — use raw fetch
- `AI_INTEGRATIONS_OPENAI_API_KEY` is a dummy string for SDK compat; do not validate it manually
- The OpenAI route handler sends the full conversation history on every turn

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
