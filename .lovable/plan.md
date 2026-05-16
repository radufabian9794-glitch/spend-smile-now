# Fix: `bun install --frozen-lockfile` fails during Docker build

## Diagnosis

The build stops at line 6 of `Dockerfile`:

```
RUN bun install --frozen-lockfile  → exit code 1
```

Docker hid the actual bun error. In ~95% of cases, this flag fails for one of two reasons:

1. **Lockfile drift** — `bun.lock` does not match `package.json` (a dependency was added/upgraded without regenerating the lockfile). `--frozen-lockfile` refuses to update it and exits 1.
2. **Network / registry issue** during the build (less likely since other images pulled fine).

## Step 1 — See the real error

Re-run the build without hiding logs so we know which case it is:

```bash
docker compose --env-file .env.docker build --no-cache --progress=plain app 2>&1 | tail -80
```

Look for lines like `lockfile had changes`, `Cannot find package`, or a network timeout.

## Step 2 — Apply the fix

### Case A: lockfile drift (most likely)

Regenerate the lockfile **on the host**, then rebuild:

```bash
bun install        # updates bun.lock to match package.json
docker compose --env-file .env.docker up -d --build
```

If `bun` isn't installed on the host, use Docker to regenerate it:

```bash
docker run --rm -v "$PWD":/app -w /app oven/bun:1 bun install
docker compose --env-file .env.docker up -d --build
```

### Case B: you can't/won't update the lockfile

Relax the flag in `Dockerfile` line 6:

```dockerfile
RUN bun install
```

Trade-off: the container build can resolve newer versions than the lockfile pins. Fine for self-hosting; less reproducible.

## Step 3 — Update plan.md

Add a short "Troubleshooting" subsection under Step 6 of `.lovable/plan.md`:

- Symptom: `bun install --frozen-lockfile` exits 1 during `docker compose build`.
- Cause: `bun.lock` out of sync with `package.json`.
- Fix: run `bun install` on the host (or via the one-shot `docker run` command above) and rebuild.

No source code changes needed unless you choose Case B.

## What I need from you

Paste the last ~40 lines of the `--progress=plain` build output so I can confirm it's lockfile drift vs. something else before we commit a fix.
