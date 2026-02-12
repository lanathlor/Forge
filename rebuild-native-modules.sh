#!/bin/bash
# Rebuild native modules inside the Docker container
# This is needed when you install new packages locally that have native dependencies

echo "Rebuilding native modules in Docker container..."
docker compose exec app sh -c "cd /app/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npm run build-release"
echo "Native modules rebuilt successfully!"
