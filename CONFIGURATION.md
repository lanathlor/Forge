# Configuration

## Application configuration

Copy `.env.example` to `.env` and set these values:

| Variable | Default | Description |
|---|---|---|
| `WORKSPACE_ROOT` | — | Path to the directory containing your git repositories |
| `DATABASE_URL` | `./forge.db` | SQLite file path, or a PostgreSQL connection string for production |
| `AI_PROVIDER` | `claude-code` | AI provider: `claude-code`, `claude-sdk`, `codex-sdk`, or `fake` |
| `CLAUDE_CODE_PATH` | `claude` | Path or name of the Claude Code CLI binary (used when `AI_PROVIDER=claude-code`) |
| `ANTHROPIC_API_KEY` | — | Anthropic API key (used when `AI_PROVIDER=claude-sdk`) |
| `OPENAI_API_KEY` | — | OpenAI API key (used when `AI_PROVIDER=codex-sdk`) |
| `NODE_ENV` | `development` | `development` or `production` |
| `PORT` | `3000` | HTTP port |

**PostgreSQL example:**

```env
DATABASE_URL="postgresql://user:password@localhost:5432/forge"
```

## Docker configuration

Additional variables used when running via Docker Compose:

| Variable | Default | Description |
|---|---|---|
| `USER_UID` | `1000` | Host user ID — matched inside the dev container for correct file permissions |
| `USER_GID` | `1000` | Host group ID — matched inside the dev container for correct file permissions |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | Path to your Claude config directory, mounted into the container |

### Development (`docker-compose.yml`)

The dev compose file mounts your source code and workspace into the container for hot-reloading. Set `WORKSPACE_ROOT` in your `.env` to the directory that contains your git repositories.

To match file ownership between host and container, set `USER_UID` and `USER_GID` to your host user's IDs:

```bash
# Find your IDs
id -u   # USER_UID
id -g   # USER_GID
```

### Production (`docker-compose.prod.yml`)

The production compose file builds the optimized Next.js standalone image and runs it as a long-lived service with health checks and automatic restarts.

**Variables:**

| Variable | Required | Description |
|---|---|---|
| `WORKSPACE_ROOT` | Yes | Path on the host to mount as `/workspace` |
| `CLAUDE_CONFIG_DIR` | If using `claude-code` | Path to your Claude config dir (default: `~/.claude`) |
| `DATABASE_URL` | If using PostgreSQL | PostgreSQL connection string |
| `POSTGRES_DB` | With `--profile postgres` | Database name (default: `forge`) |
| `POSTGRES_USER` | With `--profile postgres` | Database user (default: `forge`) |
| `POSTGRES_PASSWORD` | With `--profile postgres` | Database password (required — no default) |
| `AI_PROVIDER` | No | Defaults to `claude-code` |
| `ANTHROPIC_API_KEY` | If using `claude-sdk` | — |
| `OPENAI_API_KEY` | If using `codex-sdk` | — |
| `PORT` | No | Host port to expose (default: `3000`) |

**SQLite (default):** The production container auto-initializes the database on first start and stores it in a named Docker volume (`forge_data`).

**PostgreSQL:** Use `--profile postgres` to also start a managed Postgres container, or set `DATABASE_URL` to point to an external instance.

> **Note:** `WORKSPACE_ROOT` is mounted read-write so the AI provider can check out branches and write files inside your repositories. Ensure the host path is correct and accessible.

## Per-repository QA gates (`.forge.json`)

Each repository that Forge manages can define its own quality checks. Create a `.forge.json` file at the root of that repository.

If no `.forge.json` is present, Forge falls back to sensible defaults.

### Schema

```json
{
  "version": "1.0",
  "maxRetries": 3,
  "qaGates": [
    {
      "name": "ESLint",
      "enabled": true,
      "command": "pnpm eslint . --ext .ts,.tsx",
      "timeout": 60000,
      "failOnError": true,
      "order": 1
    }
  ]
}
```

#### Root fields

| Field | Type | Default | Description |
|---|---|---|---|
| `version` | string | `"1.0"` | Config schema version |
| `maxRetries` | number | `3` | Max retry attempts when gates fail |
| `qaGates` | array | — | List of gates to run |

#### Gate fields

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | string | — | Display name |
| `enabled` | boolean | `true` | Set to `false` to skip this gate |
| `command` | string | — | Shell command to execute |
| `timeout` | number (ms) | `60000` | How long before the gate is killed |
| `failOnError` | boolean | `true` | Stop the run if this gate fails |
| `order` | number | — | Execution order; lower runs first |

### How retries work

When a gate fails:

1. Forge captures the error output
2. The error is fed back to Claude Code as context
3. Claude attempts to fix the issue
4. Gates run again from the beginning
5. This repeats up to `maxRetries` times

If all retries are exhausted, the task is surfaced for manual review.

### Examples

#### TypeScript / Node.js

```json
{
  "version": "1.0",
  "maxRetries": 3,
  "qaGates": [
    {
      "name": "ESLint",
      "command": "pnpm eslint . --ext .ts,.tsx",
      "timeout": 60000,
      "order": 1
    },
    {
      "name": "TypeScript",
      "command": "pnpm tsc --noEmit",
      "timeout": 120000,
      "order": 2
    },
    {
      "name": "Tests",
      "command": "pnpm test --run",
      "timeout": 300000,
      "failOnError": false,
      "order": 3
    }
  ]
}
```

#### Python

```json
{
  "version": "1.0",
  "maxRetries": 3,
  "qaGates": [
    {
      "name": "Ruff Lint",
      "command": "ruff check .",
      "timeout": 60000,
      "order": 1
    },
    {
      "name": "Ruff Format",
      "command": "ruff format --check .",
      "timeout": 30000,
      "order": 2
    },
    {
      "name": "MyPy",
      "command": "mypy .",
      "timeout": 120000,
      "order": 3
    },
    {
      "name": "Pytest",
      "command": "pytest",
      "timeout": 300000,
      "failOnError": false,
      "order": 4
    }
  ]
}
```

#### Go

```json
{
  "version": "1.0",
  "maxRetries": 3,
  "qaGates": [
    {
      "name": "Format",
      "command": "gofmt -l .",
      "timeout": 30000,
      "order": 1
    },
    {
      "name": "Vet",
      "command": "go vet ./...",
      "timeout": 60000,
      "order": 2
    },
    {
      "name": "Lint",
      "command": "golangci-lint run",
      "timeout": 120000,
      "order": 3
    },
    {
      "name": "Test",
      "command": "go test ./...",
      "timeout": 300000,
      "order": 4
    }
  ]
}
```

#### Rust

```json
{
  "version": "1.0",
  "maxRetries": 3,
  "qaGates": [
    {
      "name": "Format",
      "command": "cargo fmt --check",
      "timeout": 30000,
      "order": 1
    },
    {
      "name": "Clippy",
      "command": "cargo clippy -- -D warnings",
      "timeout": 120000,
      "order": 2
    },
    {
      "name": "Check",
      "command": "cargo check",
      "timeout": 180000,
      "order": 3
    },
    {
      "name": "Test",
      "command": "cargo test",
      "timeout": 300000,
      "order": 4
    }
  ]
}
```

### Tips

**Order gates by speed** — fast checks first:

```
order 1: lint / format   (5–15s)
order 2: type-check      (10–30s)
order 3: tests           (30s–5min)
order 4: build           (1–5min, disabled by default)
```

**Use `failOnError: false`** for gates that produce warnings but shouldn't block a commit.

**Disable gates initially** with `"enabled": false` and enable them as the project matures.

## API

### Get gate config for a repository

```
GET /api/repositories/:id/qa-gates
```

Returns the parsed `.forge.json` for the given repository.

### Run gates for a task

```
POST /api/tasks/:id/qa-gates/run
```

Triggers a manual gate run (useful after manual fixes).

### Get gate results

```
GET /api/tasks/:id/qa-gates/results
```

Returns the most recent gate run results for a task.

## Troubleshooting

**Gates not running**
- Ensure `.forge.json` is at the repository root
- Validate JSON syntax (use `jq . .forge.json` or a linter)
- Check that `"enabled": true` for gates you expect to run

**Commands failing**
- Run the command manually from the repository root to test it
- Make sure all dependencies are installed

**Timeout exceeded**
- Increase the `timeout` value for slow gates
- Consider splitting a large test suite into multiple smaller gates
