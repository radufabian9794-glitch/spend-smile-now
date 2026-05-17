#!/bin/bash
# The supabase/postgres image initializes the cluster with `supabase_admin` as
# the superuser and does NOT create a `postgres` role from POSTGRES_PASSWORD.
# Our compose services (db-migrate, realtime, meta, healthcheck) all connect
# as `postgres`, so we create it here as a superuser with the env password.
# We also pre-create the auth/storage admin roles GoTrue and Storage expect.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
      CREATE ROLE postgres LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS
        PASSWORD '${POSTGRES_PASSWORD}';
    ELSE
      ALTER ROLE postgres WITH LOGIN SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS
        PASSWORD '${POSTGRES_PASSWORD}';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
      CREATE ROLE supabase_auth_admin LOGIN CREATEROLE PASSWORD '${POSTGRES_PASSWORD}';
    ELSE
      ALTER ROLE supabase_auth_admin WITH LOGIN CREATEROLE PASSWORD '${POSTGRES_PASSWORD}';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
      CREATE ROLE supabase_storage_admin LOGIN CREATEROLE PASSWORD '${POSTGRES_PASSWORD}';
    ELSE
      ALTER ROLE supabase_storage_admin WITH LOGIN CREATEROLE PASSWORD '${POSTGRES_PASSWORD}';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
      CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
      CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
      CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
      CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'authenticator_pw';
    END IF;
    GRANT anon, authenticated, service_role TO authenticator;
  END
  \$\$;

  -- Make sure the auth / storage admin roles own and can manage their schemas.
  CREATE SCHEMA IF NOT EXISTS auth       AUTHORIZATION supabase_auth_admin;
  CREATE SCHEMA IF NOT EXISTS storage    AUTHORIZATION supabase_storage_admin;
  CREATE SCHEMA IF NOT EXISTS extensions;
  CREATE SCHEMA IF NOT EXISTS realtime;
  GRANT ALL ON SCHEMA auth    TO supabase_auth_admin;
  GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
  GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role, postgres;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

  -- Storage service runs its own migrations on boot inside the postgres DB,
  -- which requires database-level CREATE/CONNECT (otherwise it dies with
  -- "permission denied for database postgres").
  GRANT ALL ON DATABASE ${POSTGRES_DB:-postgres} TO supabase_storage_admin;
  GRANT ALL ON DATABASE ${POSTGRES_DB:-postgres} TO supabase_auth_admin;

  -- GoTrue's pop migrator creates schema_migrations unqualified; pin the
  -- auth admin's search_path so it lands in the auth schema it owns.
  ALTER ROLE supabase_auth_admin SET search_path = auth;
EOSQL

