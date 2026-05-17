## Plan

Fix the Docker self-hosted startup loop where `auth` becomes unhealthy before migrations can run.

### What I’ll change

1. **Stop relying on GoTrue to create `auth.users` before migrations**
   - Add the required Supabase auth schema/table bootstrap to the Postgres init scripts so `auth.users` exists as soon as the DB is initialized.
   - This removes the circular dependency between `auth` and `db-migrate`.

2. **Restore a safer startup order**
   - Make `db-migrate` depend only on the database being healthy.
   - Make `auth` depend on `db-migrate` completing successfully.
   - Keep the other Supabase services depending on successful migrations.

3. **Clean up duplicate role/schema initialization**
   - Consolidate the overlapping role/schema setup currently split between `00-create-postgres-role.sh` and `00-roles.sql` so init is idempotent and less error-prone.

### Technical details

- The current failure likely happens because `auth` connects as `supabase_auth_admin`, but the pre-created `auth` schema and duplicate init SQL are not enough for GoTrue to finish its startup healthcheck reliably.
- The previous fix inverted dependencies, but that made `auth` responsible for creating auth tables before migrations. A more stable self-hosted pattern is:

```text
db initializes roles + auth schema/tables
        ↓
db-migrate applies app migrations referencing auth.users
        ↓
auth/rest/realtime/storage/meta start
        ↓
kong/app start
```

- I’ll keep changes limited to Docker/database init files only.