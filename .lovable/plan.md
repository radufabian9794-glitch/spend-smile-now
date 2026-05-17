## Problem

`realtime`'s `run.sh` calls `ulimit -Sn 10000`, but the container's hard limit is 2048 (inherited from the host/Docker daemon), so the call fails with `Invalid argument` and the container exits in a loop.

`RLIMIT_NOFILE=10000` (set in the env) can't be applied from inside the container without a matching hard limit.

## Fix

Edit `docker-compose.yml`, `realtime` service:

1. Add a Docker-level `ulimits` block so Docker raises the hard limit before the container starts:
   ```yaml
   ulimits:
     nofile:
       soft: 10000
       hard: 10000
   ```
2. Keep `RLIMIT_NOFILE: "10000"` in `environment` — it will now succeed.

If the host's Docker daemon still rejects the higher hard limit on this machine, fall back to:
```yaml
environment:
  RLIMIT_NOFILE: "2048"
```
(and omit the ulimits block) — realtime works fine with 2048 for a self-hosted dev stack.

## Verify

```bash
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs realtime --tail 30
```

Realtime should reach `Running RealtimeWeb.Endpoint` and stay `Up`.
