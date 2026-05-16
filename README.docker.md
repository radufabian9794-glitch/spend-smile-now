# Self-Hosted Docker Stack

Run the whole app — TanStack Start frontend/SSR plus a full self-hosted
Supabase backend — with `docker compose up`.

## Quick start

```bash
cp .env.docker.example .env.docker
# edit .env.docker — at minimum: POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY

# core stack (app + Supabase, no Studio)
docker compose --env-file .env.docker up -d --build

# include Supabase Studio (web UI) on :3001
docker compose --env-file .env.docker --profile dev up -d --build
```

After a minute or so:

| URL | What |
|---|---|
| http://localhost:3000 | The app |
| http://localhost:8000 | Supabase API gateway (Kong) |
| http://localhost:3001 | Supabase Studio (only with `--profile dev`) |
| postgres://postgres:…@localhost:5432/postgres | Direct Postgres |

## Generating `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`

`JWT_SECRET` must match across the DB, GoTrue, PostgREST, Realtime, and
Storage. The two API keys are JWTs signed with that secret.

```bash
# 1. random 40-char secret
openssl rand -base64 40 | tr -d '\n='

# 2. derive the two JWTs (paste the secret into JWT_SECRET below first)
JWT_SECRET=...your-secret...
node -e '
  const jwt = require("jsonwebtoken");
  const s = process.env.JWT_SECRET;
  const exp = Math.floor(Date.now()/1000) + 60*60*24*365*10;
  console.log("ANON_KEY=" + jwt.sign({ role: "anon", iss: "supabase", iat: Math.floor(Date.now()/1000), exp }, s));
  console.log("SERVICE_ROLE_KEY=" + jwt.sign({ role: "service_role", iss: "supabase", iat: Math.floor(Date.now()/1000), exp }, s));
'
```

(`npm i -g jsonwebtoken` first if needed, or use the official Supabase
self-hosting key generator: https://supabase.com/docs/guides/self-hosting)

Paste all three into `.env.docker`.

## How migrations work

`db-migrate` is a one-shot container. On first boot it waits for Postgres,
then runs every `*.sql` in `supabase/migrations/` in lexical order against
the fresh database. To re-run on demand:

```bash
docker compose --env-file .env.docker run --rm db-migrate
```

To wipe everything and start fresh:

```bash
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker up -d --build
```

## Networking gotcha

Inside the Docker network the app reaches Supabase as `http://kong:8000`.
Your browser reaches it as `http://localhost:8000`. That's why
`.env.docker.example` sets:

```env
VITE_SUPABASE_URL=http://localhost:8000   # browser
SUPABASE_URL=http://kong:8000             # server functions
```

If you put the app behind a real domain, set both to that public URL.

## Notes & limitations

- **App runtime**: the app is built with `@cloudflare/vite-plugin` (Workers).
  The container serves it via `wrangler dev` (miniflare). This works for
  self-hosting but is not Cloudflare's recommended high-scale production
  path — for that, deploy to Cloudflare Workers directly.
- **Email**: `GOTRUE_MAILER_AUTOCONFIRM=true` is set so signups work without
  SMTP. For real email confirmations, fill in the `SMTP_*` env vars and set
  `GOTRUE_MAILER_AUTOCONFIRM=false` in `docker-compose.yml`.
- **Lovable AI Gateway**: still calls out to Lovable's hosted endpoint via
  `LOVABLE_API_KEY`. To self-host fully, swap the AI calls in app code for a
  direct provider (OpenAI / Google / etc.).
- **Google OAuth**: add `GOTRUE_EXTERNAL_GOOGLE_ENABLED=true` plus
  `_CLIENT_ID`, `_SECRET`, `_REDIRECT_URI` env vars on the `auth` service.
- **Production hardening checklist** (not done for you):
  - Put a TLS-terminating reverse proxy (Caddy / Traefik / nginx) in front
    of `:3000` and `:8000`.
  - Move secrets from `.env.docker` into a secrets manager.
  - Schedule `pg_dump` backups of the `db-data` volume.
  - Run containers as non-root and add resource limits.
  - Pin image digests rather than tags.

## Deploying on your own Ubuntu machine

Step-by-step guide tailored for a local Ubuntu host with a custom domain
lives in [`.lovable/plan.md`](.lovable/plan.md). High-level flow:

1. Install Docker on Ubuntu (`curl -fsSL https://get.docker.com | sudo sh`).
2. `git clone` this repo.
3. `cp .env.docker.example .env.docker` and fill in the secrets (see the
   "Generating JWT_SECRET..." section above).
4. Edit `Caddyfile` — replace `yourdomain.com` with your real domain.
5. Point your domain at the machine. Pick one:
   - **`/etc/hosts` (this machine only):**
     ```
     127.0.0.1  app.yourdomain.com api.yourdomain.com
     ```
   - **DNS A-records to your LAN IP** (so other devices on your network can reach it).
6. Set in `.env.docker`:
   ```
   SITE_URL=https://app.yourdomain.com
   VITE_SUPABASE_URL=https://api.yourdomain.com
   ```
   Leave `SUPABASE_URL=http://kong:8000` as-is (that's the app→Supabase
   path inside the Docker network).
7. `docker compose --env-file .env.docker up -d --build`

Caddy auto-issues a TLS cert. For LAN-only setups Let's Encrypt can't
validate the domain, so Caddy falls back to a locally-trusted internal
cert — your browser will warn on first visit; accept it once.

If you don't want a reverse proxy yet, delete `docker-compose.override.yml`
and the stack reverts to plain `http://localhost:3000` + `http://localhost:8000`.
