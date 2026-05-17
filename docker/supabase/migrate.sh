#!/usr/bin/env sh
# Apply all SQL files in /migrations against the target Postgres instance.
# Mounted from supabase/migrations/ via docker-compose.
#
# Idempotent: a small public.schema_migrations table tracks which files have
# already been applied, so re-running this container on an existing DB is a
# safe no-op instead of failing with "relation already exists".
set -eu

: "${DB_URL:?DB_URL must be set, e.g. postgres://postgres:pw@db:5432/postgres}"

echo "[migrate] waiting for database..."
until pg_isready -d "$DB_URL" >/dev/null 2>&1; do
  sleep 1
done

# Repair grants for the storage admin role (covers DB volumes that were
# initialized before the init-db script granted these). Safe to re-run.
echo "[migrate] ensuring storage admin privileges..."
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    EXECUTE 'GRANT ALL ON DATABASE ' || quote_ident(current_database())
            || ' TO supabase_storage_admin';
    EXECUTE 'GRANT CREATE ON DATABASE ' || quote_ident(current_database())
            || ' TO supabase_storage_admin';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
ALTER SCHEMA storage OWNER TO supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA storage TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage
  GRANT ALL ON TABLES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage
  GRANT ALL ON SEQUENCES TO supabase_storage_admin;
SQL

echo "[migrate] ensuring schema_migrations tracking table..."
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename    TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

echo "[migrate] applying migrations from /migrations"
for f in /migrations/*.sql; do
  [ -f "$f" ] || continue
  name="$(basename "$f")"
  applied="$(psql "$DB_URL" -At -c \
    "SELECT 1 FROM public.schema_migrations WHERE filename = '$name'")"
  if [ "$applied" = "1" ]; then
    echo "[migrate] -- $name (already applied, skipping)"
    continue
  fi
  echo "[migrate] -> $name"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 \
    -c "INSERT INTO public.schema_migrations (filename) VALUES ('$name');"
done

echo "[migrate] done."
