## Diagnosis

`docker-compose.override.yml` is currently resetting the public ports for both `app` and `kong`:

```yaml
app:
  ports: !reset []
```

Because Docker Compose loads `docker-compose.override.yml` automatically, the app container no longer publishes host port `3000`. That makes `http://192.168.1.140:3000/` unreachable even if the app is running inside Docker.

The override is intended for the Caddy reverse-proxy setup, where traffic goes through `8080`/`8443` instead of direct `3000`/`8000`.

## Plan

1. Update `docker-compose.override.yml` so direct LAN access remains available:
   - Keep Caddy on `8080`/`8443`.
   - Stop clearing the `app` port mapping.
   - Stop clearing the `kong` port mapping unless the user explicitly wants proxy-only access.

2. Update the Docker README note so it no longer tells users to delete the override file just to use plain `http://...:3000` access.

3. Give the exact restart command:

```bash
docker compose --env-file .env.docker up -d --build
```

Then verify with:

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs app --tail 100
```

After this, `http://192.168.1.140:3000/` should be reachable again, while the Caddy proxy remains available on `http://192.168.1.140:8080/`.