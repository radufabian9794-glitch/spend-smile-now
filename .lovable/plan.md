## Problem

Our `docker/supabase/migrate.sh` created `public.schema_migrations` to track applied app migrations. Realtime's Ecto migrator also targets `schema_migrations` and expects a `version` column. It finds our table, the column is missing, and it crash-loops.

## Fix

1. Rename our tracking table to a non-colliding name: `public.lovable_schema_migrations`.
2. Update `docker/supabase/migrate.sh` to create, query, and insert into the new name (both first-run and backfill paths).
3. Add a one-time rename in the script so existing volumes upgrade cleanly:
   ```sql
   ALTER TABLE IF EXISTS public.schema_migrations
     RENAME TO lovable_schema_migrations;
   ```
   (only runs if the old table exists; safe no-op otherwise.)
4. After deploy, restart realtime; it will create its own `_realtime.schema_migrations` and run migrations cleanly.

## Verify

```bash
git pull
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker logs realtime --tail 60
docker compose --env-file .env.docker ps
```

Realtime should stay `Up` and reach `Running RealtimeWeb.Endpoint`.
