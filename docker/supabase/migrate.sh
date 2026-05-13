#!/usr/bin/env sh
# Apply all SQL files in /migrations against the target Postgres instance.
# Mounted from supabase/migrations/ via docker-compose.
set -eu

: "${DB_URL:?DB_URL must be set, e.g. postgres://postgres:pw@db:5432/postgres}"

echo "[migrate] waiting for database..."
until pg_isready -d "$DB_URL" >/dev/null 2>&1; do
  sleep 1
done

echo "[migrate] applying migrations from /migrations"
for f in /migrations/*.sql; do
  [ -f "$f" ] || continue
  echo "[migrate] -> $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "[migrate] done."
