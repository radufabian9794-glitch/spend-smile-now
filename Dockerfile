# --- build stage -------------------------------------------------------------
FROM oven/bun:1 AS build
WORKDIR /app

# VITE_* values are inlined into the JS bundle at build time. They must be
# the URLs the BROWSER will use (e.g. http://192.168.1.140:8000), not the
# in-network http://kong:8000 address. Changing them requires a rebuild.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

# DOCKER_BUILD=1 disables vite-plugin-checker (its worker threads hang the
# process after `vite build` finishes). CI=1 nudges other tools to non-interactive.
ENV DOCKER_BUILD=1 CI=1

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
COPY --from=build /app/dist ./dist
COPY --from=build /app/wrangler.jsonc ./wrangler.jsonc
COPY --from=build /app/vite.config.ts ./vite.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/src ./src

ENV NODE_ENV=production
EXPOSE 3000

# `vite preview` serves the built worker through the Cloudflare Vite plugin's
# workerd runtime — the supported preview path for this stack. We bind to all
# interfaces so the container is reachable from outside.
CMD ["bunx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]

