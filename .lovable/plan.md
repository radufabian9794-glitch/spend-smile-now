## Plan

Fix the DB init failure: `01-extensions.sql` references the `extensions` schema, which was dropped when I removed `00-roles.sql`.

### Change

Add `CREATE SCHEMA IF NOT EXISTS extensions;` (and `realtime` for parity) to `docker/supabase/init-db/00-create-postgres-role.sh`, alongside the existing `auth` and `storage` schema creation.

Result: init script runs cleanly → `01-extensions.sql` succeeds → db becomes healthy → `auth-migrate` → `db-migrate` → everything else.

Single-file change.