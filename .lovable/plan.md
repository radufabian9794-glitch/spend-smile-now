## Problem

ulimit fixed. Realtime now boots further and crashes with `APP_NAME not available` — its `runtime.exs` requires several env vars that aren't set.

## Fix

In `docker-compose.yml` under `realtime.environment`, add the required vars:

```yaml
APP_NAME: realtime
SEED_SELF_HOST: "true"
RUN_JANITOR: "true"
```

(Plus the existing DB/JWT/PORT vars already present.)

## Verify

```bash
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker logs realtime --tail 40
```

Realtime should reach `Running RealtimeWeb.Endpoint` and stay `Up`.
