#!/bin/bash
set -e

echo "=== Meridian Protocol — Starting ==="

# 0. Kill stale processes on dev ports
lsof -ti :3000 | xargs kill -9 2>/dev/null || true
lsof -ti :3001 | xargs kill -9 2>/dev/null || true

# 1. Infrastructure
echo "Starting Postgres, Redis, Mailpit..."
./scripts/bootstrap.sh

# 2. Dependencies
echo "Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 3. Env files
if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env
  echo "Created apps/api/.env — edit with your credentials if needed"
fi
if [ ! -f apps/web/.env.local ]; then
  cp apps/web/.env.example apps/web/.env.local
  echo "Created apps/web/.env.local"
fi

# 4. Database
echo "Running migrations..."
pnpm --filter @app-starter/api exec prisma migrate deploy 2>/dev/null || true
pnpm --filter @app-starter/api exec prisma generate

echo "Seeding fixture data..."
pnpm --filter @app-starter/api exec ts-node prisma/seed.ts 2>/dev/null || true
pnpm --filter @app-starter/api exec ts-node prisma/seed-aegis.ts 2>/dev/null || true

# 5. Start
echo ""
echo "=== Starting dev servers ==="
echo "Frontend: http://localhost:3000"
echo "API:      http://localhost:3001"
echo "Mailpit:  http://localhost:8025"
echo ""
pnpm dev
