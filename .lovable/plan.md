The new logs show GoTrue is still creating `schema_migrations` unqualified, so `GOTRUE_DB_NAMESPACE=auth` only affects the migration SQL templates, not the migration bookkeeping table. The practical fix is to set the DB user's default search path to `auth` before GoTrue starts.

Plan:
1. Update `docker/supabase/init-db/00-create-postgres-role.sh` so `supabase_auth_admin` has `search_path = auth`.
2. Keep `GOTRUE_DB_NAMESPACE: auth` in `docker-compose.yml` for GoTrue's auth table SQL templates.
3. Ask you to recreate the DB volume again, because init scripts only run on a fresh Postgres data directory.

Technical details:
- Add/ensure:
```sql
ALTER ROLE supabase_auth_admin SET search_path = auth;
```
- This makes GoTrue's unqualified migration table creation resolve to `auth.schema_migrations`, where the role already has ownership/CREATE privileges.
- Then run:
```bash
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker up -d
```