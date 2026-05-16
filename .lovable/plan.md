## Fix the JWT key-generation command in `.lovable/plan.md`

The current Step 3 snippet passes `JWT_SECRET=...` as a positional argument to `sh -c`, so it never becomes an env var inside the container and `jwt.sign` fails with `secretOrPrivateKey must have a value`.

### Change

In `.lovable/plan.md`, replace the broken snippet with the `-e` form so Docker injects it as a real env var:

```bash
# JWT secret
openssl rand -base64 40 | tr -d '\n='; echo

# then paste it into JWT_SECRET below and run:
docker run --rm \
  -e JWT_SECRET='<paste-the-jwt-secret-here>' \
  -v "$PWD":/w -w /w node:20-alpine sh -c \
  'npm i --silent jsonwebtoken && node -e "
    const jwt = require(\"jsonwebtoken\");
    const s = process.env.JWT_SECRET;
    const exp = Math.floor(Date.now()/1000) + 60*60*24*365*10;
    console.log(\"ANON_KEY=\" + jwt.sign({role:\"anon\",iss:\"supabase\",iat:Math.floor(Date.now()/1000),exp}, s));
    console.log(\"SERVICE_ROLE_KEY=\" + jwt.sign({role:\"service_role\",iss:\"supabase\",iat:Math.floor(Date.now()/1000),exp}, s));
  "'
```

Add a one-line note under the snippet explaining why: *"`-e JWT_SECRET=...` passes it as an env var into the container; appending `JWT_SECRET=...` after the closing quote would make it a positional shell argument instead and the secret would be empty."*

### Also apply the same fix to `README.docker.md`

The "Generating `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`" section has a host-Node version of the same command. Keep it, but add a Docker-based alternative using the `-e` form above so users without Node installed can run it safely.

No source code or compose files change.
