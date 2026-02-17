# Contributing

## Prerequisites

- Node.js 20+
- pnpm
- Docker (optional, but makes SQLite native bindings easier)

## Setup

```bash
git clone <repository-url>
cd forge
pnpm install
cp .env.example .env   # edit as needed
pnpm db:generate && pnpm db:init && pnpm db:seed
pnpm dev
```

## Project structure

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a full breakdown. The short version:

- Features live in `src/features/{feature}/` — each is self-contained
- Shared code lives in `src/shared/` — only if used by 3+ features
- API routes in `src/app/api/` are thin wrappers; logic lives in feature handlers

## Development workflow

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Run checks: `pnpm check` (type-check + lint)
4. Run tests: `pnpm test`
5. Open a pull request

## Code style

- **TypeScript strict mode** — no `any`, no implicit returns
- **Prettier** formats on save (or run `pnpm format`)
- **ESLint** enforces rules (run `pnpm lint`)
- Components in `PascalCase`, utilities in `camelCase`
- Use `@/` absolute imports, not relative `../../` paths

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add gate timeout configuration
fix: handle missing .forge.json gracefully
chore: update dependencies
docs: improve configuration examples
```

## Adding a feature

1. Create `src/features/{feature}/` with: `api/`, `components/`, `lib/`, `types/`, `store/`
2. Implement business logic in `lib/` (pure functions, no HTTP)
3. Add API handlers in `api/handlers.ts`
4. Create RTK Query endpoints in `store/{feature}Api.ts`
5. Import the store file in `src/store/index.ts` to register endpoints
6. Wire the Next.js route in `src/app/api/{feature}/route.ts`
7. Build UI in `components/`

## Testing

```bash
pnpm test           # Vitest unit + component tests
pnpm test:watch     # watch mode
pnpm test:coverage  # coverage report
pnpm test:e2e       # Playwright end-to-end
pnpm test:ui        # Vitest UI
```

Write unit tests for `lib/` functions. Write component tests for non-trivial UI. Add E2E tests for critical user flows.

## Database changes

```bash
# After editing src/db/schema/
pnpm db:generate    # generate migration SQL
pnpm db:push        # apply to local database
pnpm db:studio      # inspect data in Drizzle Studio
```

Review the generated migration before applying it.

## Reporting issues

Open an issue and include:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Forge version and OS
