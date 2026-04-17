# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev    # install deps + start with nodemon (auto-reload on file changes)
npm start      # production: node server.js
```

There are no test, lint, or build commands configured.

nodemon watches `server.js` and `inc/js/*` (recursively), and ignores `views/`, `inc/js/deprecated/`, and `inc/json-schemas/`.

## Environment Setup

Copy `sample.env` to `.env`. Required keys before the server will start:

### Required Variables

| Variable | Purpose |
|---|---|
| `MYLIFE_HOSTING_KEY` | UUID; validated at startup — missing = server crash |
| `MYLIFE_SERVER_MBR_ID` | System member partition ID in Cosmos |
| `MYLIFE_DB_ENDPOINT` / `MYLIFE_DB_RW` | Azure Cosmos DB connection |
| `MYLIFE_DB_CONTAINER_NAME` | use `members` unless homegrown container |
| `MYLIFE_DB_ENDPOINT` | use `https://mylife.documents.azure.com:443/` when approved as datasource |
| `MYLIFE_DB_RW` | required for access to MyLife system database |
| `MYLIFE_ORIGIN` | match your local or production installation |
| `MYLIFE_REGISTRATION_DB_CONTAINER_NAME` | get from admin, or link to local |
| `MYLIFE_SHARES_DB_CONTAINER_NAME` | get from admin, or link to local |
| `MYLIFE_SYSTEM_DB_CONTAINER_NAME` | get from admin, or link to local |
| `OPENAI_API_KEY` | OpenAI API access for project or spinoff |
| `OPENAI_ORG_KEY` | OpenAI Org key for MyLife or unique project spinoff |

### Important Variables

| Variable | Purpose |
|---|---|
| `PORT` | Will default to `3000` so worth addressing |
| `MAHT_EMAIL` | email address for SMTP for system correspondence |
| `MAHT_EMAIL_PASSWORD` | Password for SMTP connection |
| `MYLIFE_DB_ALLOW_SAVE` | Set to `false` during local dev to prevent writes to the production database |

## Architecture

### Module System

All application logic is ES6 modules (`"type": "module"` in package.json). Files use `.mjs` extension throughout `inc/js/`.

### Request Flow

```
server.js (Koa app + session setup)
  → routes.mjs (Koa Router — all HTTP endpoints)
    → inc/js/controllers/*.mjs (request handlers)
      → inc/js/avatar.mjs (member-facing operations)
        → inc/js/agents/system/bot-agent.mjs (team and bot (agent) logic encapsulation)
          → inc/js/agents/system/collection-agent.mjs (in-dev: will replace collections access from bot-agent.mjs)
          → inc/js/llm.mjs (OpenAI API)
        → inc/js/agents/system/asset-agent.mjs (in-dev: access to flat files and assets)
        → inc/js/agents/system/connector-agent.mjs (A2A/MCP interfaces)
        → inc/js/dataservices.mjs (CRUD)
          → inc/js/datamanager.mjs (Azure Cosmos / PostgreSQL)
        → inc/js/agents/system/experience-agent.mjs (Sharing, Tutorial, Experience compiler)
          → inc/js/llm.mjs (OpenAI API)
        → inc/js/agents/system/relationship-agent.mjs (in-dev: manages relationship with content-owning member and any content-requesting member avatar [different core account])
          → inc/js/agents/system/consent-agent.mjs (in-dev: manages natural language consent of outgoing member content)
```

### Key Files

- **`server.js`** — Entry point. Creates Koa app, instantiates the system `BotFactory` (called `_Maht`), sets up session middleware and routes.
- **`inc/js/factory.mjs`** — `BotFactory`: singleton created at startup. Initializes Dataservices, LLMServices, email, and JSON schemas. All bot/avatar instances flow through here. Uses Node.js `vm` module to dynamically extend classes from JSON config.
- **`inc/js/avatar.mjs`** — `Avatar` class (~170KB, the largest module). Each authenticated member gets an Avatar wrapping their bots. Manages bot CRUD, conversation runs, instruction "shadows" (templates), and delegates to LLM and data layers.
- **`inc/js/llm.mjs`** — `LLMServices`: thin wrapper over OpenAI's Assistants API. Creates/manages assistants and threads, runs conversations with function-calling, handles streaming, and dispatches MCP and A2A (Agent-to-Agent) tool calls.
- **`inc/js/routes.mjs`** — All HTTP route definitions. Maps paths to controller functions; handles session validation and auth checks.
- **`inc/js/dataservices.mjs`** — High-level CRUD API (avatars, bots, memories, alerts, etc.).
- **`inc/js/datamanager.mjs`** — Low-level DB access for Azure Cosmos DB and PostgreSQL.
- **`inc/js/globals.mjs`** — Shared utilities: validation, sanitization, helpers used across the codebase.
- **`inc/js/models.mjs`** — Data models: `Item` (root story class), `Memory`, `Entry`, `Conversation`, `Value`, `Issue`.

### Controllers (`inc/js/controllers/`)

| File | Responsibility |
|---|---|
| `api-functions.mjs` | REST API endpoints |
| `bot-functions.mjs` | Bot management endpoints |
| `a2a-functions.mjs` | Agent-to-Agent communication (34KB) |
| `mcp-functions.mjs` | Model Context Protocol handling (51KB) |
| `memory-functions.mjs` | Memory sharing/consent |
| `functions.mjs` | Core page/session handlers |
| `nanda-functions.mjs` | NANDA server registry integration |
| `jsonrpc-functions.mjs` | JSON-RPC protocol |

### System Agents (`inc/js/agents/system/`)

These are modular assistants (not autonomous agents) integrated into the Avatar lifecycle. Each extends `EventEmitter`:

- **`asset-agent.mjs`** — File handling and storage
- **`bot-agent.mjs`** — Bot/Team management for a member
- **`collections-agent.mjs`** — Bulk list operations
- **`connector-agent.mjs`** — External service integrations
- **`evolution-agent.mjs`** — Avatar lifecycle phases: `create → init → develop → mature → maintain → retire`
- **`experience-agent.mjs`** — Member experiences

### Session Management

Sessions use `koa-generic-session` with `MemoryStore`. `app.context.mcpSessionMeta` (a `Map`) tracks active MCP transports across streaming connections. Sessions time out at 15 minutes (configurable via `MYLIFE_SESSION_TIMEOUT_MS`); a cleanup interval runs every 10 minutes.

### MCP Integration

The platform acts as both an MCP server and client. `inc/js/controllers/mcp-functions.mjs` handles protocol negotiation, streaming (SSE), tool dispatch, and session lifecycle. Tool schemas live in `inc/json-schemas/mcp/tools/`. The MCP protocol version is set via `MCP_JSONRPC_Protocol` in `.env`.

### Schemas and Configuration

- `inc/json-schemas/` — JSON schemas for data structures, OpenAI function definitions, and MCP tool definitions. Changes here do **not** trigger nodemon.
- `inc/yaml/` — OpenAI action schemas (YAML format for GPT Store integration).
- `inc/js/factory-class-extenders/` — Class extension logic evaluated via `vm` at runtime to dynamically add methods to factory classes from JSON config.

### Frontend

EJS templates in `views/`. Static assets (CSS/JS/images) served from `views/assets/`. CSS uses Bootstrap + Font Awesome + flex layout. Frontend communicates with the server exclusively through REST endpoints and SSE streams.

### Deployment

CI/CD via GitHub Actions to Azure Web App (see `.github/workflows/azure-deploy-prod_maht.yml`). The app runs on port `process.env.PORT` (default 3000).
