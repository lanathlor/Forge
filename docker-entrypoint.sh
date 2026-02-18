#!/bin/sh
set -e

case "${DATABASE_URL:-}" in
  postgresql://*|postgres://*)
    echo "PostgreSQL detected — initializing schema..."
    node /app/db-init-pg.js
    ;;
  *)
    echo "Initializing SQLite database..."
    node /app/db-init.js || true
    ;;
esac

exec "$@"
