<p align="center">
  <img src="public/favicon.svg" alt="Forge" width="120" height="120" />
</p>

<h1 align="center">Forge</h1>

<p align="center">
  <strong>AI writes code. Your scripts decide if it ships.</strong>
</p>

<p align="center">
  Self-hosted · Multi-repository · Multi-provider · Provider-agnostic
</p>

---

After a 10-step plan, Claude Code would leave me with a pile of lint errors, broken types, and failing tests. Fixing it all at the end was worse than writing it myself. I tried keeping the plan in a `.md` file and asking it to go step by step — better, but I kept catching it _lying_ about having run the QA gates. So I had to check every time, then ask it to patch every time. Forge automates what I was doing manually: run the task, run _my_ scripts, pass or retry. The AI never gets to say "looks good to me."

---

## Preview

**Dashboard** — multi-repo sidebar, live plan monitor, session task input, and task list in one view:

![Forge dashboard](public/screenshots/dashboard.png)

**Plan detail** — phases and tasks with status badges, dependency links, and commit references:

![Plan detail with phases and tasks](public/screenshots/plan-phases.png)

**QA gates** — deterministic pipeline per repository; drag to reorder, toggle required/optional:

![QA gates configuration](public/screenshots/qa-gates.png)

---

## Quickstart

### Prerequisites

- Node.js 20+, pnpm
- A workspace directory containing git repositories
- An AI provider API key (Anthropic or OpenAI)

### Install & run

```bash
git clone https://github.com/lanathlor/Forge
cd forge
pnpm install
cp .env.example .env
```

Edit `.env`:

```env
WORKSPACE_ROOT="/path/to/your/projects"
DATABASE_URL="./forge.db"
AI_PROVIDER=claude-sdk
ANTHROPIC_API_KEY=your-key-here
```

```bash
pnpm db:generate
pnpm db:init
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). That's it.

### Configure QA gates

Drop a `.forge.json` at the root of any repo you want Forge to manage:

```json
{
  "maxRetries": 3,
  "qaGates": [
    { "name": "ESLint", "command": "pnpm eslint . --ext .ts,.tsx" },
    { "name": "TypeScript", "command": "pnpm tsc --noEmit" },
    { "name": "Tests", "command": "pnpm test --run" },
    { "name": "Build", "command": "pnpm build" }
  ]
}
```

Your existing scripts. Your existing quality standards. Forge runs them after every AI task — no negotiation.

See [CONFIGURATION.md](./CONFIGURATION.md) for the full schema and examples for Python, Go, and Rust.

---

## AI Providers

| Provider        | `AI_PROVIDER` | Auth                  | Notes                                         |
| --------------- | ------------- | --------------------- | --------------------------------------------- |
| Claude SDK      | `claude-sdk`  | `ANTHROPIC_API_KEY`   | Recommended — direct Anthropic API            |
| Codex SDK       | `codex-sdk`   | `OPENAI_API_KEY`      | OpenAI Codex, works with ChatGPT subscription |
| Claude Code CLI | `claude-code` | Claude Code installed | Spawns CLI as child process                   |
| Fake            | `fake`        | None                  | Deterministic responses for testing/CI        |

Swap providers in `.env`. Your call, your auth, your ToS.

---

## How it works

1. **You create a plan** — structured steps and tasks, stored in a database. Not in the AI's context window. Queryable, inspectable, persistent.

2. **Forge picks a task** and invokes your AI provider with controlled context. The AI does the coding. Forge decides what to code, when, and how much context it sees.

3. **Forge runs your QA gates.** Not AI review. Your actual scripts — lint, typecheck, test, coverage. Whatever's in `.forge.json`.

4. **Gates pass → commit. Gates fail → retry or escalate.** The AI never decides if its own work is good enough.

The plan lives in the database. Pause overnight, resume tomorrow. Provider crashes mid-task — restart, pick up where you left off. Run a query to see which task types fail QA gates most often. The plan is yours, not the AI's.

---

## Why

Every AI coding tool lets the AI decide when to plan, when to test, when to commit. Sometimes it runs your tests. Sometimes it doesn't. Sometimes it hallucinates that tests pass.

Every "AI orchestrator" is just more AI. Gas Town: Claude coordinating Claude. Copilot Orchestra: AI reviewing AI. GitHub Agent HQ: AI agents making their own decisions.

Forge does the embarrassingly obvious thing: treat AI like any other tool in your pipeline. You don't let `npm install` decide whether to run. You don't let your build tool decide whether tests matter. Why would you let an AI make those decisions?

```
provider.execute(task, context) → code changes
yourScript.sh                   → pass or fail
```

That's the whole idea.

### Forge built Forge

Halfway through building it, I pointed Forge at its own repo. It worked — clunky, but it worked. The codebase is the proof. Go read it. It's vibe coded and I won't pretend otherwise, but it's maintainable and the tech debt is manageable. That's more than I can say for most AI-generated codebases I've seen.

A note on that: Forge is the only project I've vibe coded, and I don't recommend vibe coding. This is a thought experiment, not a workflow endorsement. If I find myself still reaching for Forge in a few months, I'll rebuild it properly — using Forge itself, but with the manual control turned way up. That's kind of the point.

---

## Deployment

### Recommended: run on the host

The simplest and most capable setup. QA gate commands run with whatever tools exist on your machine — `pnpm`, `bun`, `go`, `cargo`, `python`, `maven`, anything.

```bash
pnpm install
pnpm build
```

**With SQLite (no extra setup):**

```bash
pnpm db:init

DATABASE_URL="./forge.db" \
WORKSPACE_ROOT="/path/to/your/projects" \
AI_PROVIDER=claude-sdk \
ANTHROPIC_API_KEY=sk-ant-... \
PORT=3000 \
NODE_ENV=production \
NEXT_TELEMETRY_DISABLED=1 \
pnpm start
```

**With PostgreSQL:**

```bash
docker run -d --name forge-pg \
  -e POSTGRES_USER=forge -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=forge \
  -p 5432:5432 postgres:16-alpine

DATABASE_URL="postgresql://forge:secret@localhost:5432/forge" \
npx tsx src/db/init-pg.ts

DATABASE_URL="postgresql://forge:secret@localhost:5432/forge" \
WORKSPACE_ROOT="/path/to/your/projects" \
AI_PROVIDER=claude-sdk \
ANTHROPIC_API_KEY=sk-ant-... \
PORT=3000 \
NODE_ENV=production \
NEXT_TELEMETRY_DISABLED=1 \
pnpm start
```

### Docker (limited QA gate support)

Docker is available but **QA gate commands run inside the container** — only Node 20, pnpm, yarn, and git are available. No `bun`, `go`, `cargo`, `python`, etc.

**Development:**

```bash
cp .env.example .env
docker compose up
```

**Production:**

```bash
POSTGRES_PASSWORD=your-secret \
DATABASE_URL=postgresql://forge:your-secret@postgres:5432/forge \
WORKSPACE_ROOT=/path/to/your/projects \
AI_PROVIDER=claude-sdk \
ANTHROPIC_API_KEY=sk-ant-... \
docker compose -f docker-compose.prod.yml --profile postgres up -d
```

| File                      | Purpose                                                      |
| ------------------------- | ------------------------------------------------------------ |
| `docker-compose.yml`      | Development — hot-reload, source mounted                     |
| `docker-compose.prod.yml` | Production — standalone image, health checks, restart policy |

See [CONFIGURATION.md](./CONFIGURATION.md) for all environment variables.

---

## Tech stack

|             |                                                  |
| ----------- | ------------------------------------------------ |
| Framework   | Next.js 15 (App Router)                          |
| Language    | TypeScript 5 (strict)                            |
| Database    | SQLite (dev) / PostgreSQL (prod) via Drizzle ORM |
| State       | Redux Toolkit + RTK Query                        |
| UI          | Tailwind CSS + shadcn/ui                         |
| Code editor | Monaco Editor                                    |
| Real-time   | Server-Sent Events                               |
| Container   | Docker + Docker Compose                          |

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

Forge uses a vertical-slice (feature-based) architecture. See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](LICENSE)
