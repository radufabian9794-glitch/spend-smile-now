## Goal
Make the app reachable from any LAN device at `http://192.168.1.140:3000` by removing the Caddy reverse proxy and exposing the app + Supabase ports directly.

## Steps (user runs on the Ubuntu host)

1. Remove the Caddy override so ports `:3000` (app) and `:8000` (Supabase/Kong) get published again:
   ```bash
   rm docker-compose.override.yml
   ```

2. Edit `.env.docker` so the browser-facing URLs point at the LAN IP (not `localhost`, which would mean "the device you're browsing from"):
   ```env
   SITE_URL=http://192.168.1.140:3000
   VITE_SUPABASE_URL=http://192.168.1.140:8000
   ```
   Leave `SUPABASE_URL=http://kong:8000` as-is — that's the app→Supabase path inside the Docker network.

3. Rebuild + restart. The app needs `--build` because `VITE_SUPABASE_URL` is baked into the client bundle at build time:
   ```bash
   docker compose --env-file .env.docker down
   docker compose --env-file .env.docker up -d --build
   ```

4. If Ubuntu's firewall is active, open the ports:
   ```bash
   sudo ufw status
   sudo ufw allow 3000/tcp
   sudo ufw allow 8000/tcp
   ```

5. Verify from any LAN device:
   - App: `http://192.168.1.140:3000`
   - Supabase API health: `http://192.168.1.140:8000/auth/v1/health`

## Notes

- No source files change; this is all infra/config.
- Traffic is plain HTTP on the LAN. Fine for local use; add TLS (Caddy with a real domain) before exposing to the public internet.
- Google OAuth, if you add it later, needs the redirect URI to match `SITE_URL` exactly.
