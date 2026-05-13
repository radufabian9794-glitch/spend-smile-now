# --- build stage -------------------------------------------------------------
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- run stage ---------------------------------------------------------------
# The project is built with @cloudflare/vite-plugin (Workers runtime), so we
# serve the built worker with wrangler/miniflare. For high-scale production,
# deploy to Cloudflare Workers instead — see README.docker.md.
FROM oven/bun:1 AS run
WORKDIR /app

COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY --from=build /app/wrangler.jsonc ./wrangler.jsonc
COPY --from=build /app/src/server.ts ./src/server.ts

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bunx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "3000", "--no-show-interactive-dev-session"]
