-- Lista de espera de la landing. Mientras no abramos, el formulario del hero
-- guarda mail + rol acá. Cuando abramos, ese form pasa a ser el ingreso.

create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique,
  role text not null check (role in ('inquilino', 'propietario')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.waitlist_signups is
  'Mails de la lista de espera. Solo escribe el servidor; nadie puede leerla desde el cliente.';

create trigger waitlist_signups_set_updated_at
  before update on public.waitlist_signups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- seguridad
alter table public.waitlist_signups enable row level security;
alter table public.waitlist_signups force row level security;

-- Ni anon ni authenticated tocan esta tabla: se escribe desde el servidor con
-- service role, después de validar y de pasar por el rate limiting. Sin
-- políticas, RLS deniega todo: la lista no se puede leer ni enumerar.
revoke all on public.waitlist_signups from anon, authenticated;
