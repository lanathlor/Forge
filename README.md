# Autobot - Claude Code Oversight Dashboard

A QA gate dashboard for Claude Code with automated testing, diff review, and approval workflows.

## Features (Planned)

- **Multi-Repository Management**: Discover and manage multiple git repositories in your workspace
- **Session Tracking**: Track Claude Code sessions with complete history
- **Automated QA Gates**: Run ESLint, TypeScript checks, and tests automatically
- **3-Retry Logic**: Automatically retry failed QA gates with error feedback to Claude
- **Diff Review**: Visual diff viewer with Monaco Editor
- **Approval Workflow**: Review, approve, and commit changes with AI-generated commit messages
- **Reject & Revert**: Safely reject changes and revert to previous state
- **Real-time Updates**: Server-Sent Events for live progress updates
- **Redux State Management**: RTK Query for efficient API caching

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.x (strict mode)
- **Database**: SQLite (dev) / PostgreSQL (production) with Drizzle ORM
- **State**: Redux Toolkit + RTK Query
- **UI**: Tailwind CSS + shadcn/ui + Radix UI
- **Code Editor**: Monaco Editor
- **Container**: Docker + Docker Compose

## Project Structure

```
autobot/
├── src/
│   ├── app/              # Next.js App Router pages and layouts
│   ├── components/       # React components (UI and dashboard)
│   ├── db/              # Database schema, migrations, and client
│   ├── lib/             # Business logic and utilities
│   ├── store/           # Redux store and RTK Query API
│   ├── hooks/           # Custom React hooks
│   └── types/           # TypeScript type definitions
├── plans/               # Project documentation and specs
├── Dockerfile           # Docker configuration
├── docker-compose.yml   # Docker Compose configuration
└── package.json         # Dependencies and scripts
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- Docker and Docker Compose (optional but recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd autobot
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Initialize the database:
   ```bash
   pnpm db:generate  # Generate migrations
   pnpm db:init      # Create database
   pnpm db:seed      # Seed with default QA gates
   ```

5. Start development server:
   ```bash
   pnpm dev
   ```

   Visit [http://localhost:3000](http://localhost:3000)

### Using Docker (Recommended)

Docker ensures all dependencies (including Python for better-sqlite3) are available:

```bash
docker-compose up
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Development

### Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm format` - Format code with Prettier
- `pnpm type-check` - Run TypeScript compiler check
- `pnpm check` - Run type-check + lint
- `pnpm db:generate` - Generate Drizzle migrations
- `pnpm db:push` - Push schema to database
- `pnpm db:studio` - Open Drizzle Studio (database GUI)
- `pnpm db:init` - Initialize database
- `pnpm db:seed` - Seed database with default data
- `pnpm test` - Run unit tests
- `pnpm test:e2e` - Run end-to-end tests

### Adding shadcn/ui Components

```bash
pnpx shadcn@latest add button
pnpx shadcn@latest add card
pnpx shadcn@latest add dialog
# etc.
```

## Configuration

### Environment Variables

- `DATABASE_URL` - Database connection string (default: `./dev.db`)
- `WORKSPACE_ROOT` - Path to workspace containing git repositories
- `CLAUDE_CODE_PATH` - Path to Claude Code CLI (default: `claude`)
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: `3000`)

### QA Gates

QA gates are now configured per-repository using `.autobot.json` files. This allows each repository to define gates specific to its tech stack.

**Quick Start:**
1. Create `.autobot.json` in your repository root
2. Define QA gates for your tech stack (ESLint, TypeScript, Tests, etc.)
3. Autobot automatically loads and runs these gates

**Example configurations available:**
- `examples/.autobot.json.typescript` - TypeScript/Node.js projects
- `examples/.autobot.json.python` - Python projects
- `examples/.autobot.json.go` - Go projects
- `examples/.autobot.json.rust` - Rust projects

See [AUTOBOT-CONFIG.md](./AUTOBOT-CONFIG.md) for complete documentation.

## Phase 3 Status: ✅ Complete (Per-Repository QA Gates)

### What Was Done

1. ✅ **Per-Repository Configuration System**
   - Created `.autobot.json` schema with Zod validation
   - Configuration loader with automatic fallback to defaults
   - Support for TypeScript, JavaScript, Python, Go, and Rust

2. ✅ **QA Gate Runner with 3-Retry Logic**
   - Automatic retry up to 3 attempts (configurable per repo)
   - Error feedback formatting for Claude re-invocation
   - Sequential execution with early termination
   - Database tracking of attempts and results

3. ✅ **Built-in Gate Implementations**
   - ESLint with JSON output parsing
   - TypeScript with error extraction
   - Tests (Vitest/Jest) support
   - Custom error parsers per gate type

4. ✅ **API Endpoints**
   - `GET /api/repositories/:id/qa-gates` - Load repo config
   - `POST /api/tasks/:id/qa-gates/run` - Run gates for task
   - `GET /api/tasks/:id/qa-gates/results` - Fetch results
   - `GET /api/qa-gates` - API documentation

5. ✅ **UI Components**
   - QAGateResults component with expandable errors
   - Attempt tracking (1/3, 2/3, 3/3)
   - Status visualization (passed/failed/skipped)
   - Re-run and override controls

6. ✅ **Example Configurations**
   - TypeScript/Node.js template
   - Python (Ruff, MyPy, Pytest) template
   - Go (gofmt, vet, golangci-lint) template
   - Rust (Clippy, fmt, test) template

7. ✅ **Documentation**
   - Comprehensive configuration guide (AUTOBOT-CONFIG.md)
   - Schema reference and best practices
   - Migration guide from database config

### Benefits of Per-Repository Config

✅ **Version Control**: Configuration tracked in git
✅ **Tech Stack Flexibility**: Each repo defines its own gates
✅ **Language Agnostic**: Works with any technology
✅ **Easy Sharing**: Copy configs between similar projects
✅ **No Database Updates**: Just edit the JSON file

## Phase 1 Status: ✅ Complete

### What Was Done

1. ✅ Next.js project initialization with TypeScript and Tailwind CSS
2. ✅ All core dependencies installed (Drizzle, Redux, shadcn/ui, etc.)
3. ✅ TypeScript configured with strict mode
4. ✅ ESLint and Prettier setup
5. ✅ Environment configuration (.env)
6. ✅ Complete Drizzle ORM schema defined:
   - `repositories` - Git repository tracking
   - `sessions` - Claude Code session management
   - `tasks` - Task execution and status
   - `qa_gate_configs` - QA gate configurations
   - `qa_gate_results` - QA gate execution results
7. ✅ Database migrations generated
8. ✅ Database seed script with default QA gates
9. ✅ Docker setup (Dockerfile + docker-compose.yml)
10. ✅ Redux Toolkit + RTK Query configured
11. ✅ Custom React hooks (useAppDispatch, useAppSelector)
12. ✅ Utility functions and TypeScript types
13. ✅ shadcn/ui configuration

### Next Steps (Phase 2)

- Repository discovery and scanning
- Session management
- Claude Code integration
- QA gate execution system

## Known Issues

- **better-sqlite3**: Requires Python and build tools to compile native bindings. Use Docker to avoid build issues on your local machine.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines (coming soon).

## License

[MIT](LICENSE)

## Related Documentation

- [Implementation Roadmap](plans/IMPLEMENTATION-ROADMAP.md)
- [Technical Architecture](plans/99-technical-architecture.md)
- [Feature Specifications](plans/)
