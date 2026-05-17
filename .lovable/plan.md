# Why `db-migrate` still fails after the volume wipe

The password format is fine, the volume was reset with `down -v`, yet `psql` still gets `FATAL: password authentication failed for user "postgres"`. That means one of these is true:

1. `db` and `db-migrate` are seeing **different** values for `POSTGRES_PASSWORD` (env-file not actually being applied to one of them).
2. The Postgres volume was **not** actually wiped (a stray named volume from a different compose project still attached).
3. The `supabase/postgres` image set a different password during init (e.g. it ran before `POSTGRES_PASSWORD` was visible, falling back to a default).

Before changing any code, run these read-only checks on the laptop.

## Step 1 — confirm both containers see the same password

```bash
docker compose --env-file .env.docker config | grep -E 'POSTGRES_PASSWORD|DB_URL' 
```

Every occurrence should show the same literal hex value. If any line shows `POSTGRES_PASSWORD: ""` or a different value, the env-file isn't reaching that service.

Also check at runtime:

```bash
docker compose --env-file .env.docker up -d db
docker compose --env-file .env.docker exec db printenv POSTGRES_PASSWORD
```

Compare against:

```bash
grep '^POSTGRES_PASSWORD=' .env.docker
```

All three must be byte-identical.

## Step 2 — verify the volume was actually wiped

```bash
docker volume ls | grep -E 'db-data|lovable'
```

If you see `lovable-selfhost_db-data` listed with an old creation date (not from today), then `down -v` didn't remove it — likely because it was created under a different compose `name:` previously. Force remove:

```bash
docker compose --env-file .env.docker down -v --remove-orphans
docker volume rm lovable-selfhost_db-data lovable-selfhost_storage-data 2>/dev/null || true
docker volume prune -f
```

## Step 3 — try logging in manually

With `db` running:

```bash
PW=$(grep '^POSTGRES_PASSWORD=' .env.docker | cut -d= -f2-)
docker run --rm --network lovable-selfhost_supabase -e PGPASSWORD="$PW" \
  postgres:15-alpine psql -h db -U postgres -d postgres -c 'select 1;'
```

- If this **succeeds**, the problem is specifically how `db-migrate` builds its `DB_URL` (likely env-file not applied to that service).
- If it **fails**, the password stored in the DB is not what's in `.env.docker` — the volume kept old data, or init never ran with the current password.

## Step 4 — what to do based on results

- **Step 1 shows mismatched/empty value for `db-migrate`**: docker compose isn't passing `--env-file` to one-shot `run` invocations. Fix by adding an explicit `env_file: [.env.docker]` block to the `db-migrate` service in `docker-compose.yml`.
- **Step 2 shows the volume survived**: remove it explicitly (commands above), then `up -d` again.
- **Step 3 manual login fails**: the DB was initialized with a different password. Wipe again with the explicit `volume rm` commands and bring up fresh.

## Likely outcome

Most common cause in this shape: `lovable-selfhost_db-data` wasn't actually removed (Docker keeps volumes if anything still references them, including a stopped `db-migrate` container from the previous run). The explicit `volume rm` after `down -v --remove-orphans` will resolve it.

Paste back the output of Steps 1–3 and I'll point at the exact fix.
