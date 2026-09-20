-- Bitácora de acciones sensibles: confirmaciones de pago, invitaciones
-- aceptadas, links compartibles creados y revocados, borrado de cuenta.
-- A propósito NO guardamos IP ni user agent: es dato personal que no
-- necesitamos (Ley 25.326, principio de minimización).

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor on public.audit_log (actor_id, created_at desc);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

-- Nadie escribe ni lee desde el cliente: la bitácora sería falsificable.
-- Escribe el servidor con service role.
revoke all on public.audit_log from anon, authenticated;
