#!/bin/sh
set -e

# Run database initialization for SQLite on first start.
# Skipped when DATABASE_URL points to a PostgreSQL instance.
case "${DATABASE_URL:-}" in
  postgresql://*|postgres://*)
    echo "PostgreSQL detected — skipping SQLite init."
    ;;
  *)
    echo "Initializing SQLite database..."
    node /app/db-init.js || true
    ;;
esac

exec "$@"
