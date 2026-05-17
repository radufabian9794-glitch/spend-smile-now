Real progress: the `postgres` role fix worked. New failure is a chicken-and-egg between GoTrue and our migrations.

**Root cause**
The first app migration has `REFERENCES auth.users(id)`. The `auth.users` table is created by GoTrue (the `auth` service) on its first start — not by Postgres. Today `auth` `depends_on: db-migrate`, and `db-migrate` references `auth.users`, so migrations always run before the table exists.

**Fix: invert the dependency**
Let GoTrue bootstrap the `auth` schema first, then run our migrations.

1. In `docker-compose.yml`:
   - Make `auth` depend only on `db` (`service_healthy`), not on `db-migrate`.
   - Add a healthcheck to `auth` (HTTP GET `/health` on port 9999).
   - Make `db-migrate` depend on `auth` being healthy instead of just `db`.
   - Keep `rest`, `realtime`, `storage`, `meta` depending on `db-migrate` completion so the app schema exists before they start.

2. Reset and verify on the laptop:

```bash
git pull
docker compose --env-file .env.docker down -v --remove-orphans
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker logs db-migrate
```

Expected: `auth` starts, creates `auth.users`, becomes healthy → `db-migrate` runs successfully → everything else starts.

No app source code changes — Docker config only.