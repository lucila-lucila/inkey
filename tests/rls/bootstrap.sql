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

-- Versión mínima de storage: buckets, objects y foldername(), que es lo que
-- usan nuestras políticas de documentos.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;
grant all on storage.buckets to service_role;

-- Devuelve las carpetas de la ruta (todo menos el nombre del archivo).
create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  _partes text[];
begin
  _partes := string_to_array(name, '/');
  return _partes[1:array_length(_partes, 1) - 1];
end;
$$;

-- auth.uid() lee el claim `sub` del JWT, igual que en Supabase.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid;
$$;
