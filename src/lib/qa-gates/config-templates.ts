import type { AutobotConfig } from './config-loader';

export const TYPESCRIPT_CONFIG: AutobotConfig = {
  version: '1.0',
  maxRetries: 3,
  qaGates: [
    {
      name: 'ESLint',
      enabled: true,
      command: 'pnpm eslint . --ext .ts,.tsx',
      timeout: 60000,
      failOnError: true,
      order: 1,
    },
    {
      name: 'TypeScript',
      enabled: true,
      command: 'pnpm tsc --noEmit',
      timeout: 120000,
      failOnError: true,
      order: 2,
    },
    {
      name: 'Tests',
      enabled: true,
      command: 'pnpm test --run',
      timeout: 300000,
      failOnError: false,
      order: 3,
    },
    {
      name: 'Build',
      enabled: false,
      command: 'pnpm build',
      timeout: 180000,
      failOnError: true,
      order: 4,
    },
  ],
};

export const JAVASCRIPT_CONFIG: AutobotConfig = {
  version: '1.0',
  maxRetries: 3,
  qaGates: [
    {
      name: 'ESLint',
      enabled: true,
      command: 'npm run lint',
      timeout: 60000,
      failOnError: true,
      order: 1,
    },
    {
      name: 'Tests',
      enabled: true,
      command: 'npm test',
      timeout: 300000,
      failOnError: true,
      order: 2,
    },
  ],
};

export const PYTHON_CONFIG: AutobotConfig = {
  version: '1.0',
  maxRetries: 3,
  qaGates: [
    {
      name: 'Ruff',
      enabled: true,
      command: 'ruff check .',
      timeout: 60000,
      failOnError: true,
      order: 1,
    },
    {
      name: 'MyPy',
      enabled: true,
      command: 'mypy .',
      timeout: 120000,
      failOnError: true,
      order: 2,
    },
    {
      name: 'Pytest',
      enabled: true,
      command: 'pytest',
      timeout: 300000,
      failOnError: false,
      order: 3,
    },
  ],
};

export const GO_CONFIG: AutobotConfig = {
  version: '1.0',
  maxRetries: 3,
  qaGates: [
    {
      name: 'Go Fmt',
      enabled: true,
      command: 'go fmt ./...',
      timeout: 30000,
      failOnError: true,
      order: 1,
    },
    {
      name: 'Go Vet',
      enabled: true,
      command: 'go vet ./...',
      timeout: 60000,
      failOnError: true,
      order: 2,
    },
    {
      name: 'Go Test',
      enabled: true,
      command: 'go test ./...',
      timeout: 300000,
      failOnError: true,
      order: 3,
    },
  ],
};

export const RUST_CONFIG: AutobotConfig = {
  version: '1.0',
  maxRetries: 3,
  qaGates: [
    {
      name: 'Clippy',
      enabled: true,
      command: 'cargo clippy -- -D warnings',
      timeout: 120000,
      failOnError: true,
      order: 1,
    },
    {
      name: 'Rust Format',
      enabled: true,
      command: 'cargo fmt --check',
      timeout: 30000,
      failOnError: true,
      order: 2,
    },
    {
      name: 'Cargo Test',
      enabled: true,
      command: 'cargo test',
      timeout: 300000,
      failOnError: true,
      order: 3,
    },
  ],
};

export const CONFIG_TEMPLATES: Record<string, AutobotConfig> = {
  typescript: TYPESCRIPT_CONFIG,
  javascript: JAVASCRIPT_CONFIG,
  python: PYTHON_CONFIG,
  go: GO_CONFIG,
  rust: RUST_CONFIG,
};
