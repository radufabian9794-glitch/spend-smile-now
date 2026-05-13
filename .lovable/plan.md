# Self-Hosted Docker Compose Stack

Goal: run the whole app locally (or on any Docker host) with one `docker compose up` — the TanStack Start app plus a self-hosted Supabase stack, with your existing migrations applied automatically.

## What gets added

New files at the project root:

```text
Dockerfile                    # builds the TanStack Start app
.dockerignore
docker-compose.yml            # orchestrates app + Supabase services
.env.docker.example           # template for required env vars
docker/
  supabase/
    kong.yml                  # Kong gateway routes (Supabase API surface)
    init-db/
      00-roles.sql            # creates Supabase internal roles
      01-extensions.sql       # pgcrypto, uuid-ossp, pgjwt, etc.
    migrate.sh                # applies supabase/migrations/*.sql on boot
README.docker.md              # how to run, reset, and connect
```

No source files in `src/` change. `wrangler.jsonc` stays as-is (Cloudflare deploy still works in parallel).

## Services in `docker-compose.yml`

| Service | Image | Purpose |
|---|---|---|
| `db` | `supabase/postgres:15.6.1.139` | Postgres with Supabase extensions |
| `db-migrate` | `postgres:15-alpine` | One-shot: applies `supabase/migrations/*.sql` against `db`, then exits |
| `auth` | `supabase/gotrue:v2.158.1` | Email/password + OAuth |
| `rest` | `postgrest/postgrest:v12.2.0` | Auto REST API from schema |
| `realtime` | `supabase/realtime:v2.30.34` | Postgres changes over WebSocket |
| `storage` | `supabase/storage-api:v1.11.13` | File storage (backed by `db` + local volume) |
| `meta` | `supabase/postgres-meta:v0.83.2` | Schema introspection |
| `kong` | `kong:2.8.1` | Single API gateway on `:8000` (this is the `SUPABASE_URL` the app uses) |
| `studio` | `supabase/studio:20240729-ce42139` | Web UI on `:3001` (optional, dev only) |
| `app` | built from `Dockerfile` | The TanStack Start app on `:3000` |

All services share a `supabase` Docker network. Volumes: `db-data`, `storage-data`.

## App `Dockerfile` (multi-stage, Bun)

```text
# build stage
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# run stage — TanStack Start outputs a Node server bundle by default,
# so we serve it with Bun for speed and small image size
FROM oven/bun:1-slim AS run
WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./
ENV PORT=3000 HOST=0.0.0.0
EXPOSE 3000
CMD ["bun", "run", ".output/server/index.mjs"]
```

Note: the project currently builds for Cloudflare Workers via `@cloudflare/vite-plugin`. To produce a Node-compatible build for the container, the plan adds a second build target by setting `target: "node"` in a Docker-only build step (env-gated in `vite.config.ts`) — the Cloudflare build path is untouched. If you'd rather keep Vite config unchanged, alternative is to run the app with `wrangler dev` inside the container — let me know.

## Migrations on boot

`db-migrate` waits for `db` to be healthy, then runs:

```bash
for f in /migrations/*.sql; do psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done
```

Your existing files in `supabase/migrations/` (5 of them) are mounted read-only into the container, so the schema (categories, expenses, profiles, RLS, triggers, `has_role`, etc.) is recreated on a fresh volume.

## Environment

`.env.docker.example` documents everything; you copy to `.env.docker` and fill in. Key variables:

- `POSTGRES_PASSWORD` — DB superuser password
- `JWT_SECRET` — 32+ char random string; signs Supabase JWTs
- `ANON_KEY`, `SERVICE_ROLE_KEY` — JWTs derived from `JWT_SECRET` (README explains how to generate with the official Supabase script or `openssl`)
- `SITE_URL=http://localhost:3000` — used by GoTrue for redirects
- `LOVABLE_API_KEY` — your existing AI gateway key (only if you keep using Lovable AI)
- App-side: `VITE_SUPABASE_URL=http://localhost:8000`, `VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY`

Inside the Docker network the app talks to Supabase at `http://kong:8000`; from your browser it's `http://localhost:8000`. The README covers this gotcha.

## How you'll use it

```bash
cp .env.docker.example .env.docker
# edit .env.docker — at minimum set POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
docker compose --env-file .env.docker up -d
# app:    http://localhost:3000
# studio: http://localhost:3001
# api:    http://localhost:8000
```

`docker compose down -v` wipes data. `docker compose up db-migrate` re-applies migrations.

## Out of scope (call out before I build)

- Lovable AI Gateway is a hosted service; if you self-host fully, you'll need to swap it for a direct provider (OpenAI / Google / etc.) — I'll leave a TODO in the README, not change app code.
- Email: GoTrue ships with no SMTP by default, so signup confirmations won't actually deliver. README will document plugging in your SMTP creds (or disabling confirmations for local dev).
- Production hardening (TLS, secrets manager, backups, non-root users, resource limits) — included as a checklist in the README, not configured.
- Google OAuth: works the same as on Lovable Cloud once you set `GOTRUE_EXTERNAL_GOOGLE_*` env vars; documented in README.

## Open questions

1. **Vite Node build target** — OK to env-gate a Node build in `vite.config.ts` for Docker (keeps Cloudflare path intact)? Or prefer running `wrangler dev` inside the container?
2. **Studio included?** — handy for dev, ~200 MB image. Include behind a `--profile dev` flag so prod runs lean?
3. **Realtime + Storage** — your app doesn't currently use either. Include them now (matches "full Supabase") or skip to keep the stack smaller?
