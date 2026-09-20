-- Imita lo que Supabase ya trae hecho en un proyecto nuevo, para que las
-- migraciones corran igual acá que allá:
--   * los roles anon / authenticated / service_role,
--   * el esquema auth con auth.users y auth.uid(),
--   * el esquema extensions,
--   * los privilegios por defecto de Supabase sobre public.
-- Si esto no fuera fiel, los tests de RLS estarían probando otra cosa.

create schema if not exists extensions;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- Privilegios por defecto de Supabase: todo lo que se cree en public queda
-- accesible para los tres roles salvo que la migración lo revoque.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;

-- Versión mínima de auth.users: lo único que usan nuestras migraciones.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- auth.uid() lee el claim `sub` del JWT, igual que en Supabase.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid;
$$;
