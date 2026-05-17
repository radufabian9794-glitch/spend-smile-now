The logs identify the real failure: the database image initialized without a `postgres` database role. So the password is no longer the primary issue; every service and migration command is trying to connect as `postgres`, but that role does not exist.

Plan:

1. Confirm the actual admin role created by the database image
   - Run a one-off check inside the DB container using the likely Supabase admin role:

```bash
docker compose --env-file .env.docker exec -u postgres db \
  psql -U supabase_admin -d postgres -c '\du'
```

2. If `supabase_admin` works, update the Docker stack to use it as the DB admin user
   - Change these places from `postgres` to `supabase_admin`:
     - `db` healthcheck user
     - `db-migrate` `DB_URL`
     - `realtime` `DB_USER`
     - `meta` `PG_META_DB_USER`
     - README direct Postgres examples

3. Add a safety init SQL migration for local self-hosting
   - Make `docker/supabase/init-db/00-roles.sql` create/repair expected internal roles idempotently.
   - Avoid relying on the missing `postgres` role.
   - Ensure auth/storage admin roles required by the compose services exist if the image does not create them.

4. Reset and verify from a clean volume
   - Run:

```bash
docker compose --env-file .env.docker down -v --remove-orphans
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker logs db-migrate
```

Expected result: `db-migrate` completes successfully, then auth/rest/realtime/storage/kong/app start normally.