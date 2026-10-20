-- Platform prelude: what the rest of the schema expects from the database.
--
-- Row-level security is written against two roles (`authenticated`, `anon`) and a function
-- `auth.uid()`. Neon does not ship those, so they are defined here; `withRls` in
-- src/lib/db/client.ts switches into `authenticated` and sets `request.jwt.claims` for the
-- length of a transaction. The app connects as the database owner, which is made a member of
-- both roles so it can do that.
--
-- Users live in `neon_auth."user"`, maintained by Managed Better Auth. On a Neon branch with
-- Auth enabled the table already exists and is left alone; on a plain Postgres (local
-- development, tests) a minimal stand-in with the columns the app reads is created.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
end;
$$;

do $$
begin
  execute format('grant authenticated, anon to %I', current_user);
exception when others then
  -- Already a member, or the platform manages membership itself.
  null;
end;
$$;

grant usage on schema public to authenticated, anon;

create schema if not exists auth;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
      ''
    ),
    ''
  )::uuid
$$;

grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

create schema if not exists neon_auth;

create table if not exists neon_auth."user" (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  role text,
  banned boolean,
  "banReason" text,
  "banExpires" timestamptz
);
