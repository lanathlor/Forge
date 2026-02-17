# Forge

Most AI coding tools let the AI decide when to run tests, whether the output is good enough, and when to commit. Forge doesn't.

Forge is a deterministic orchestrator that treats AI as a tool — like a compiler or a linter — not a decision-maker. You define the plan. Forge invokes the AI on each task, runs your actual QA gates (the scripts already in your repo), and only commits when they pass. The AI never decides if its own work is good enough.

Self-hosted, multi-repository, works with [Claude Code](https://claude.ai/code), the [Claude SDK](https://docs.anthropic.com/en/docs/claude-code/sdk), or [OpenAI Codex](https://platform.openai.com/docs/guides/code).

## What it does

When your AI agent finishes working on a task, Forge steps in:

1. **Runs QA gates** — lint, type-check, tests — whatever you define per repository
2. **Shows you the diff** — side-by-side in Monaco Editor with syntax highlighting
3. **Lets you approve or reject** — approve commits with an AI-generated message, or revert cleanly
4. **Retries automatically** — if a gate fails, Forge sends the errors back to your AI agent and tries again (up to 3 times)

Everything is tracked: sessions, tasks, gate results, commit SHAs.

## Supported AI providers

Forge works with any of the following out of the box, selected via the `AI_PROVIDER` environment variable:

| Provider | Value | Description |
|---|---|---|
| Claude Code (CLI) | `claude-code` | Spawns the Claude Code CLI as a child process — the default |
| Claude SDK | `claude-sdk` | Direct Anthropic API integration via the Claude SDK |
| OpenAI Codex SDK | `codex-sdk` | OpenAI Codex API via the OpenAI SDK |
| Fake (testing) | `fake` | Hardcoded deterministic responses for CI/local dev |

See [CONFIGURATION.md](./CONFIGURATION.md) for provider-specific environment variables.

## Features

- **Multi-provider**: switch between Claude Code, Claude SDK, Codex, or a fake provider with a single env var
- **Multi-repository**: manage all your git repositories from one dashboard
- **Per-repo QA gates**: each repo defines its own checks via `.forge.json` — works with TypeScript, Python, Go, Rust, or anything with a CLI
- **3-retry loop**: failed gates feed their errors directly back to the AI agent for auto-correction
- **Visual diff viewer**: Monaco Editor with syntax highlighting and file navigation
- **Approval workflow**: AI-generated conventional commit messages, editable before commit
- **Safe rejection**: one click to revert to the previous git state
- **Real-time updates**: live progress via Server-Sent Events
- **Session history**: full audit trail of tasks, attempts, and results

## Tech stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict) |
| Database | SQLite (dev) / PostgreSQL (prod) via Drizzle ORM |
| State | Redux Toolkit + RTK Query |
| UI | Tailwind CSS + shadcn/ui |
| Code editor | Monaco Editor |
| Real-time | Server-Sent Events |
| Container | Docker + Docker Compose |

## Getting started

### Prerequisites

- Node.js 20+
- pnpm
- A workspace directory containing git repositories
- An AI provider — Claude Code CLI, an Anthropic API key, or an OpenAI API key (depending on which provider you choose)

### Install

```bash
git clone <repository-url>
cd forge
pnpm install
```

### Configure

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Path to the directory containing your git repositories
WORKSPACE_ROOT="/path/to/your/projects"

# SQLite for local use; swap for PostgreSQL in production
DATABASE_URL="./forge.db"

# AI provider: claude-code (default) | claude-sdk | codex-sdk | fake
AI_PROVIDER=claude-code

# Claude Code (default provider — requires Claude Code CLI installed)
CLAUDE_CODE_PATH=claude

# Claude SDK (set AI_PROVIDER=claude-sdk)
# ANTHROPIC_API_KEY=your-key-here

# Codex SDK (set AI_PROVIDER=codex-sdk)
# OPENAI_API_KEY=your-key-here
```

### Initialize the database

```bash
pnpm db:generate
pnpm db:init
pnpm db:seed
```

### Start

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Docker (recommended)

Docker handles native build dependencies (better-sqlite3) for you:

```bash
docker-compose up
```

App runs at [http://localhost:3001](http://localhost:3001).

## QA gate configuration

Each repository is configured independently. Create a `.forge.json` at the root of any repo you want Forge to manage:

```json
{
  "version": "1.0",
  "maxRetries": 3,
  "qaGates": [
    {
      "name": "ESLint",
      "command": "pnpm eslint . --ext .ts,.tsx",
      "order": 1
    },
    {
      "name": "TypeScript",
      "command": "pnpm tsc --noEmit",
      "order": 2
    },
    {
      "name": "Tests",
      "command": "pnpm test --run",
      "failOnError": false,
      "order": 3
    }
  ]
}
```

See [CONFIGURATION.md](./CONFIGURATION.md) for the full schema and examples for Python, Go, and Rust.

## Development

```bash
pnpm dev           # development server
pnpm build         # production build
pnpm check         # type-check + lint
pnpm test          # unit tests
pnpm test:e2e      # end-to-end tests (Playwright)
pnpm db:studio     # Drizzle Studio (database GUI)
```

## Architecture

Forge uses a vertical-slice (feature-based) architecture. See [ARCHITECTURE.md](./ARCHITECTURE.md) for a full breakdown of the codebase structure, state management patterns, and conventions.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](LICENSE)
