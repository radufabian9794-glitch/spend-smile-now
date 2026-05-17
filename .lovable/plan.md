## Root cause

The container is starting `vite preview`, and TanStack Start’s Vite preview plugin is looking for `/app/dist/server/server.js`. In this project’s Cloudflare/TanStack build, that file is not the runtime entry in the Docker image, so preview falls through to a missing server bundle and returns 500.

## Plan

1. **Update the Docker runtime command**
   - Replace the run-stage `CMD` from `bunx vite preview ...` to `bunx wrangler dev --ip 0.0.0.0 --port 3000`.
   - This matches the existing README’s intended self-host mode and serves the built Worker entry from `wrangler.jsonc` instead of Vite’s Node preview fallback.

2. **Make the run image explicitly include the files Wrangler needs**
   - Keep copying `dist`, `wrangler.jsonc`, `src`, and dependencies.
   - Ensure the final image has enough project metadata for Wrangler to resolve the configured worker entry cleanly.

3. **Update Docker docs/comments**
   - Align the Dockerfile comments with the actual runtime (`wrangler dev` / miniflare), so the next rebuild instructions are clear.

4. **Validation guidance**
   - After the change, rebuild the app image with:
     ```bash
     docker compose --env-file .env.docker down
     docker compose --env-file .env.docker up -d --build
     ```
   - Then open the app through the exposed proxy/port and check:
     ```bash
     docker compose --env-file .env.docker logs app --tail 100
     ```
   - The missing `/app/dist/server/server.js` message should be gone.