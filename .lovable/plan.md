# Fix lockfile drift in Docker build

Confirmed cause: `bun.lock` doesn't match `package.json`, so `--frozen-lockfile` aborts. Pick one fix.

## Option A — Regenerate the lockfile (recommended, keeps reproducibility)

On your Ubuntu machine, in the repo root:

```bash
docker run --rm -v "$PWD":/app -w /app oven/bun:1 bun install
docker compose --env-file .env.docker up -d --build
```

The first command rewrites `bun.lock` in place to match `package.json`. The second rebuilds and starts the stack. Since this is your self-hosted clone, the updated `bun.lock` only needs to live on this machine — no need to push it anywhere.

## Option B — Drop the `--frozen-lockfile` flag

Edit `Dockerfile` line 6:

```dockerfile
RUN bun install
```

Then rebuild:

```bash
docker compose --env-file .env.docker up -d --build
```

Trade-off: the container resolves whatever versions satisfy `package.json` at build time, which is fine for self-hosting but slightly less reproducible than Option A.

## Recommendation

Go with **Option A**. It's a one-liner, fixes the root cause, and keeps the build deterministic on subsequent rebuilds.

## Plan.md

The Troubleshooting section already covers both options — no further edits needed.
