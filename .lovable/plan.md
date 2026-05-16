# Fix `.lovable/plan.md`

`.lovable/plan.md` currently contains a meta-note about rolling back the file, not the actual Deployment Guide. Restore the original guide from git and append a Troubleshooting section for the `bun install --frozen-lockfile` build error.

## Actions

1. Restore the original Deployment Guide:
   ```bash
   git show 4569d57:.lovable/plan.md > .lovable/plan.md
   ```

2. Append a new `## Troubleshooting` section at the end covering the build failure you hit:

   **Symptom**
   ```
   error: lockfile had changes, but lockfile is frozen
   failed to solve: process "/bin/sh -c bun install --frozen-lockfile" did not complete successfully: exit code: 1
   ```

   **Cause** — `bun.lock` is out of sync with `package.json`, so `--frozen-lockfile` refuses to install.

   **Fix A (recommended) — regenerate the lockfile, then rebuild:**
   ```bash
   docker run --rm -v "$PWD":/app -w /app oven/bun:1 bun install
   docker compose --env-file .env.docker up -d --build
   ```

   **Fix B (fallback) — drop the strict flag** by editing `Dockerfile` line 6 from `RUN bun install --frozen-lockfile` to `RUN bun install`, then rebuild. Less reproducible but acceptable for self-hosting.

No source code changes. Existing Deployment Guide steps stay intact; only a new trailing section is added.
