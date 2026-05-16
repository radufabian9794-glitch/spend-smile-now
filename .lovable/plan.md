## Problem

Your Docker build hangs for ~19 minutes on `RUN bun run build`. The log shows Vite finishing successfully:

```
dist/server/assets/wallet-C-J_DYA0.js  908.07 kB
✓ built in 5.22s
```

…and then the process refuses to exit. The bundle is already on disk — something is keeping Node alive after Vite is done.

## Root cause

The prime suspect is **`vite-plugin-checker`** in `vite.config.ts`. It spawns long-lived TypeScript + ESLint worker threads. The `enableBuild: false` flag tells it to skip the *checks* during `vite build`, but the plugin and its workers are still attached to the Vite process. In a TTY-less Docker build with limited cores, those workers sometimes never receive a clean shutdown signal and the build process hangs until Docker's default timeout.

The Dockerfile also has a second latent bug: it copies `/app/.output` from the build stage, but `vite build` outputs to `dist/` (visible in your log: `dist/server/assets/...`). Once the hang is fixed, the run stage will fail because `.output` doesn't exist. We should fix both in one pass.

## Fix

Three changes, all in infrastructure files — **no `src/` changes**:

**1. Gate `vite-plugin-checker` so it doesn't load during Docker builds.**

Edit `vite.config.ts` to only include the plugin when not in a CI/Docker build:

```ts
const isDockerBuild = process.env.DOCKER_BUILD === "1";

export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  vite: {
    plugins: isDockerBuild ? [] : [
      checker({ /* existing config */ }),
    ],
  },
});
```

**2. Set `DOCKER_BUILD=1` in the Dockerfile build stage.**

```dockerfile
FROM oven/bun:1 AS build
WORKDIR /app
ENV DOCKER_BUILD=1 CI=1
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
```

`CI=1` also helps other tools (including any leftover componentTagger watchers) pick a non-interactive code path.

**3. Fix the run stage to copy the correct output directory.**

The current Dockerfile copies `/app/.output`, which `vite build` does not produce. Replace it with `/app/dist`:

```dockerfile
FROM oven/bun:1 AS run
WORKDIR /app

COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/wrangler.jsonc ./wrangler.jsonc
COPY --from=build /app/src/server.ts ./src/server.ts

ENV NODE_ENV=production
EXPOSE 3000
CMD ["bunx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "3000", "--no-show-interactive-dev-session"]
```

## Update to `.lovable/plan.md`

Append a new troubleshooting subsection — **"Build hangs after `✓ built in …`"** — under the existing Troubleshooting section. It will document the symptom, the cause (vite-plugin-checker workers + missing `dist` copy), and the three-line fix above. The original Deployment Guide stays untouched.

## Verification

After the changes:

```bash
docker compose --env-file .env.docker build --no-cache app
```

Expected: `bun run build` finishes in well under a minute, the build stage exits, and the run stage proceeds to copy `dist/` and start wrangler.

## Fallback if the hang persists

If checker isn't the culprit, the next thing to gate is `@cloudflare/vite-plugin`'s post-build worker validation. We can add a `--logLevel debug` flag to `vite build` in the Dockerfile to confirm exactly which plugin is the last one running, then either disable that plugin in Docker mode or switch to `bunx wrangler deploy --dry-run` as the actual build command. I'll only do this if step 1 doesn't resolve it.
