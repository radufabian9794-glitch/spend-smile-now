Move Caddy off the conflicting host ports so it can coexist with Apache on :80/:443.

## Change

Edit `docker-compose.override.yml`: remap Caddy's host ports from `80:80` and `443:443` to `8080:80` and `8443:443`. Container-internal ports stay the same, so the `Caddyfile` and all upstream service config remain unchanged.

```yaml
caddy:
  ports:
    - "8080:80"
    - "8443:443"
```

## After applying

```bash
docker compose --env-file .env.docker up -d
docker compose --env-file .env.docker ps
```

Access URLs become:
- http://app.yourdomain.com:8080 (or https://...:8443)
- http://api.yourdomain.com:8080

## Note on Let's Encrypt

Caddy's automatic HTTPS via Let's Encrypt requires ports 80 and 443 on the public interface — it won't work on 8080/8443. For a LAN/local setup with self-signed certs this is fine. If you later want real certs, you'll need to free :80/:443 (stop Apache) or use Caddy's DNS-01 challenge.
