-- Perfil de la persona. Una sola cuenta puede ser inquilina en un alquiler y
-- dueña en otro: el rol NO vive acá, vive en cada alquiler (Fase 2).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (char_length(btrim(first_name)) between 2 and 60),
  last_name text check (char_length(btrim(last_name)) between 2 and 60),
  phone text check (phone ~ '^[0-9+().[:space:]-]{8,20}$'),
  avatar_url text,
  -- Solo decide qué pantalla mostramos primero en el onboarding.
  initial_intent text check (initial_intent in ('inquilino', 'propietario')),
  accepted_terms_at timestamptz,
  accepted_privacy_at timestamptz,
  -- Borrado de cuenta (Fase 7): el perfil se despersonaliza, no se borra en
  -- cascada, porque el historial también es de la contraparte.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Datos personales. El historial de alquiler cuelga de acá pero vive en otras tablas.';
comment on column public.profiles.initial_intent is
  'Respuesta a "¿Qué querés hacer primero?". No limita lo que la persona puede hacer después.';
comment on column public.profiles.deleted_at is
  'Cuenta dada de baja: el perfil queda despersonalizado y deja de mostrarse.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- El onboarding está completo cuando hay nombre, apellido y términos aceptados.
create or replace function public.profile_is_onboarded(p public.profiles)
returns boolean
language sql
immutable
as $$
  select p.first_name is not null
     and p.last_name is not null
     and p.accepted_terms_at is not null
     and p.accepted_privacy_at is not null
     and p.deleted_at is null;
$$;

-- Alta automática del perfil cuando nace el usuario de auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- seguridad
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;

-- Cada quien ve y edita únicamente su propio perfil.
-- (En la Fase 2 se suma una política para ver el perfil de la contraparte de
-- un alquiler; hoy no hay alquileres todavía.)
create policy "perfil propio: lectura"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "perfil propio: edición"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()) and deleted_at is null)
  with check (id = (select auth.uid()));

-- Sin política de INSERT ni DELETE a propósito: el alta la hace el trigger y
-- la baja es un flujo controlado del servidor (Fase 7).
