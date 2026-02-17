# Forge

A self-hosted oversight dashboard for [Claude Code](https://claude.ai/code). Forge watches your AI coding sessions, automatically runs your QA checks, and gives you a clean review-and-approve interface before anything gets committed.

## What it does

When Claude Code finishes working on a task, Forge steps in:

1. **Runs QA gates** — lint, type-check, tests — whatever you define per repository
2. **Shows you the diff** — side-by-side in Monaco Editor with syntax highlighting
3. **Lets you approve or reject** — approve commits with an AI-generated message, or revert cleanly
4. **Retries automatically** — if a gate fails, Forge sends the errors back to Claude and tries again (up to 3 times)

Everything is tracked: sessions, tasks, gate results, commit SHAs.

## Features

- **Multi-repository**: manage all your git repositories from one dashboard
- **Per-repo QA gates**: each repo defines its own checks via `.forge.json` — works with TypeScript, Python, Go, Rust, or anything with a CLI
- **3-retry loop**: failed gates feed their errors directly back to Claude for auto-correction
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
- A Claude Code workspace (a directory containing git repositories)

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
