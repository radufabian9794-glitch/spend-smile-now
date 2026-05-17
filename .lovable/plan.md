## Plan

I’ll make the Docker self-host stack restart cleanly and stop the current container crash loop.

### Changes

1. **Make app database migrations idempotent**
   - Update the migration runner to record applied SQL files in a small `public.schema_migrations` table.
   - On restart, already-applied migrations will be skipped instead of re-running and failing with `relation "expenses" already exists`.
   - This fixes the `db-migrate` failure after the first successful run.

2. **Fix Storage database permissions**
   - Extend the Postgres init script so `supabase_storage_admin` can create/manage what the Storage service needs in the `postgres` database.
   - Add database-level privileges, schema ownership/grants, and default privileges for the `storage` schema.
   - Because init scripts only run on a fresh DB volume, also add the same repair grants to the migration runner so existing local volumes are fixed on next `up`.

3. **Fix Realtime `RLIMIT_NOFILE` crash**
   - Add the missing `RLIMIT_NOFILE` environment variable to the `realtime` service.
   - Keep the existing container image/version unchanged.

4. **Fix app container startup**
   - The app image currently runs `wrangler dev` against `src/server.ts`, but the runtime image only copies `src/server.ts` and not its imported `src/lib/*` files, causing missing module errors.
   - Copy the needed `src/lib` runtime files into the run image.
   - Switch the container command to `vite preview --host 0.0.0.0 --port 3000`, which is the supported preview path for the Cloudflare Vite plugin and should resolve the `tanstack-start-injected-head-scripts` virtual module error.

5. **Update Docker docs**
   - Adjust the self-host notes so they mention Caddy is now exposed on host `8080/8443` and the app uses Vite preview inside Docker.

### After applying

You’ll run:

```bash
git pull
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

If Storage still shows the old permission error because the DB volume was initialized before these grants existed, run once:

```bash
docker compose --env-file .env.docker run --rm db-migrate
```

The expected result is `db-migrate` exits successfully, `realtime`, `storage`, and `app` stay `Up`, and Caddy remains available on `8080/8443`.