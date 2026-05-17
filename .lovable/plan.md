## Root cause

The container's SSR throws "Missing Supabase environment variable(s)" → `src/server.ts` catches it and returns the generic 500 "Internal Server Error" page.

Why: Vite replaces `import.meta.env.VITE_*` **at build time**, but the Dockerfile's `RUN bun run build` runs with no `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` set. Docker Compose's `environment:` block only injects vars at *runtime*, not into `docker build`. So the compiled bundle has `undefined` for both. At request time, `createSupabaseClient()` throws → SSR 500.

The fallback `|| process.env.SUPABASE_URL` doesn't save us because the app runs inside `workerd` (Cloudflare runtime) where `process.env` is populated from `wrangler.jsonc` vars, not from container env vars.

## Fix — pass VITE_* as Docker build args

### 1. `Dockerfile` — accept build args, expose as env during build

After `WORKDIR /app` in the build stage (line 3), add:

```dockerfile
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
```

### 2. `docker-compose.yml` — pass them under `app.build.args`

Change the `app.build` block from:

```yaml
build:
  context: .
  dockerfile: Dockerfile
```

to:

```yaml
build:
  context: .
  dockerfile: Dockerfile
  args:
    VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
    VITE_SUPABASE_PUBLISHABLE_KEY: ${VITE_SUPABASE_PUBLISHABLE_KEY}
```

(Keep the existing `environment:` block — it stays useful for SSR fallbacks if those env vars get wired into wrangler later.)

### 3. `.env.docker.example` — document the LAN-IP setup

Add a comment near `VITE_SUPABASE_URL` clarifying that the value here is baked into the JS bundle at build time, so it must be the URL the **browser** uses (e.g. `http://192.168.1.140:8000`), and any change requires `--build`.

## User runs after the edit

```bash
git pull
docker compose --env-file .env.docker up -d --build app
```

Then `http://192.168.1.140:3000` should load. If it still 500s, we'll inspect container logs:

```bash
docker compose --env-file .env.docker logs app --tail 100
```

## Why not other approaches

- Adding `vars` to `wrangler.jsonc` would let SSR read `process.env`, but the client bundle would still be broken (blank screen / login form that can't talk to Supabase). Build args fix both sides at once.
- Switching back to `localhost:8000` won't work because the user is browsing from a different LAN device.
