# Autobot Configuration Guide

## Overview

Autobot uses per-repository configuration files to define QA gates. Each repository can have its own `.autobot.json` file tailored to its specific tech stack and requirements.

## Configuration File

Create a `.autobot.json` file in the root of your repository:

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

## Schema Reference

### Root Configuration

| Field        | Type   | Required | Default | Description                              |
| ------------ | ------ | -------- | ------- | ---------------------------------------- |
| `version`    | string | No       | `"1.0"` | Configuration schema version             |
| `maxRetries` | number | No       | `3`     | Maximum number of QA gate retry attempts |
| `qaGates`    | array  | Yes      | -       | Array of QA gate configurations          |

### QA Gate Configuration

| Field         | Type    | Required | Default | Description                                  |
| ------------- | ------- | -------- | ------- | -------------------------------------------- |
| `name`        | string  | Yes      | -       | Display name for the gate                    |
| `enabled`     | boolean | No       | `true`  | Whether this gate is active                  |
| `command`     | string  | Yes      | -       | Shell command to execute                     |
| `timeout`     | number  | No       | `60000` | Timeout in milliseconds                      |
| `failOnError` | boolean | No       | `true`  | Whether to stop execution if this gate fails |
| `order`       | number  | No       | -       | Execution order (lower runs first)           |

## How It Works

1. **Automatic Loading**: Autobot automatically loads `.autobot.json` from each repository
2. **Default Fallback**: If no config file exists, a sensible default configuration is used
3. **Sequential Execution**: Gates run in order, with early termination on failure (if `failOnError: true`)
4. **Retry Logic**: Failed gates trigger automatic retries (up to `maxRetries` times)
5. **Error Feedback**: Failed gate errors are prepared for Claude to fix and retry

## Example Configurations

### TypeScript/Node.js Project

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
    },
    {
      "name": "TypeScript",
      "enabled": true,
      "command": "pnpm tsc --noEmit",
      "timeout": 120000,
      "failOnError": true,
      "order": 2
    },
    {
      "name": "Tests",
      "enabled": true,
      "command": "pnpm test --run",
      "timeout": 300000,
      "failOnError": false,
      "order": 3
    }
  ]
}
```

### Python Project

```json
{
  "version": "1.0",
  "maxRetries": 3,
  "qaGates": [
    {
      "name": "Ruff Linting",
      "enabled": true,
      "command": "ruff check .",
      "timeout": 60000,
      "failOnError": true,
      "order": 1
    },
    {
      "name": "Ruff Format",
      "enabled": true,
      "command": "ruff format --check .",
      "timeout": 30000,
      "failOnError": true,
      "order": 2
    },
    {
      "name": "MyPy Type Checking",
      "enabled": true,
      "command": "mypy .",
      "timeout": 120000,
      "failOnError": true,
      "order": 3
    },
    {
      "name": "Pytest",
      "enabled": true,
      "command": "pytest",
      "timeout": 300000,
      "failOnError": false,
      "order": 4
    }
  ]
}
```

### Go Project

```json
{
  "version": "1.0",
  "maxRetries": 3,
  "qaGates": [
    {
      "name": "Go Format",
      "enabled": true,
      "command": "gofmt -l .",
      "timeout": 30000,
      "failOnError": true,
      "order": 1
    },
    {
      "name": "Go Vet",
      "enabled": true,
      "command": "go vet ./...",
      "timeout": 60000,
      "failOnError": true,
      "order": 2
    },
    {
      "name": "golangci-lint",
      "enabled": true,
      "command": "golangci-lint run",
      "timeout": 120000,
      "failOnError": true,
      "order": 3
    },
    {
      "name": "Go Test",
      "enabled": true,
      "command": "go test ./...",
      "timeout": 300000,
      "failOnError": true,
      "order": 4
    }
  ]
}
```

### Rust Project

```json
{
  "version": "1.0",
  "maxRetries": 3,
  "qaGates": [
    {
      "name": "Cargo Format Check",
      "enabled": true,
      "command": "cargo fmt --check",
      "timeout": 30000,
      "failOnError": true,
      "order": 1
    },
    {
      "name": "Clippy",
      "enabled": true,
      "command": "cargo clippy -- -D warnings",
      "timeout": 120000,
      "failOnError": true,
      "order": 2
    },
    {
      "name": "Cargo Check",
      "enabled": true,
      "command": "cargo check",
      "timeout": 180000,
      "failOnError": true,
      "order": 3
    },
    {
      "name": "Cargo Test",
      "enabled": true,
      "command": "cargo test",
      "timeout": 300000,
      "failOnError": true,
      "order": 4
    }
  ]
}
```

## Best Practices

### 1. Order Your Gates Strategically

Run fast checks first (linting, formatting) before slow ones (tests, builds):

```json
{
  "order": 1, // Fast: ESLint (5-10s)
  "order": 2, // Fast: TypeScript (10-20s)
  "order": 3, // Slow: Tests (30s-5min)
  "order": 4 // Slowest: Build (1-5min)
}
```

### 2. Use Appropriate Timeouts

- Linting: 30-60 seconds
- Type checking: 60-120 seconds
- Tests: 300-600 seconds (5-10 minutes)
- Builds: 180-600 seconds (3-10 minutes)

### 3. Decide When to Fail Fast

Set `failOnError: true` for critical gates, `false` for optional ones:

```json
{
  "name": "ESLint",
  "failOnError": true  // Critical - must pass
},
{
  "name": "Tests",
  "failOnError": false  // Optional - warning only
}
```

### 4. Disable Optional Gates Initially

Start with essential gates enabled, add more as needed:

```json
{
  "name": "Build",
  "enabled": false // Enable later when needed
}
```

## API Endpoints

### Get Repository QA Gates

```bash
GET /api/repositories/:id/qa-gates
```

Returns the QA gate configuration for a specific repository, loaded from its `.autobot.json` file.

### Run QA Gates for a Task

```bash
POST /api/tasks/:id/qa-gates/run
```

Manually run QA gates for a task (useful for re-running after manual fixes).

### Get QA Gate Results

```bash
GET /api/tasks/:id/qa-gates/results
```

Get the results of the most recent QA gate run for a task.

## Example Templates

Pre-configured templates are available in the `examples/` directory:

- `.autobot.json.typescript` - TypeScript/Node.js projects
- `.autobot.json.python` - Python projects
- `.autobot.json.go` - Go projects
- `.autobot.json.rust` - Rust projects

Copy the appropriate template to your repository:

```bash
cp examples/.autobot.json.typescript /path/to/your/repo/.autobot.json
```

## Troubleshooting

### Gates Not Running

- Ensure `.autobot.json` is in the repository root
- Verify JSON syntax is valid
- Check that `enabled: true` for gates you want to run

### Commands Failing

- Test commands manually in the repository: `cd /path/to/repo && your-command`
- Ensure all dependencies are installed (npm/pnpm/cargo/etc.)
- Check that command paths are correct for your system

### Timeout Issues

- Increase `timeout` value for slow-running gates
- Consider splitting large test suites into separate gates

### Wrong Tech Stack Detected

- Create a custom `.autobot.json` with your specific commands
- Override the default configuration with repo-specific needs

## Migration from Database Config

The old database-based configuration has been replaced with per-repository JSON files. Benefits:

✅ **Version Control**: Configuration is tracked in git
✅ **Per-Repo Customization**: Each project defines its own gates
✅ **Language Agnostic**: Works with any tech stack
✅ **Easy Sharing**: Copy config between similar projects
✅ **No Database Updates**: Just edit the JSON file

To migrate: Create `.autobot.json` in each repository with your desired configuration.
