# Rollback `.lovable/plan.md` and append the fix

The plan tool overwrote `plan.md` with the diagnosis. I'll restore the original Deployment Guide (from git commit `4569d57`) and append a short Troubleshooting section at the end — without touching the existing steps.

## Action

1. Restore `.lovable/plan.md` from git: `git show 4569d57:.lovable/plan.md > .lovable/plan.md`
2. Append a Troubleshooting section covering the `bun install --frozen-lockfile` lockfile-drift error and the one-line fix:
   ```bash
   docker run --rm -v "$PWD":/app -w /app oven/bun:1 bun install
   docker compose --env-file .env.docker up -d --build
   ```
3. Also mention the fallback (edit `Dockerfile` line 6 to `RUN bun install`).

No source code changes. Original Deployment Guide content stays intact.
