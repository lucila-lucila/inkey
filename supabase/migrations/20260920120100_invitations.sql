-- Invitaciones. El token viaja en el link (WhatsApp, mail, copiado a mano) y
-- de él guardamos únicamente el hash: si alguien se lleva la base, no se lleva
-- ningún link vivo.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  invited_role text not null check (invited_role in ('owner', 'tenant')),
  token_hash text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  sent_to_email extensions.citext,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on column public.invitations.token_hash is
  'sha256 del token. El token en claro solo existe en el link que recibe la persona.';

create index invitations_rental on public.invitations (rental_id, created_at desc);

-- Una sola invitación viva por alquiler: si se regenera, la anterior se revoca.
create unique index invitations_una_viva_por_alquiler
  on public.invitations (rental_id)
  where accepted_at is null and revoked_at is null;

-- Ni el token ni el alquiler ni la aceptación se editan a mano: lo único que
-- la app cambia por update es revoked_at.
create or replace function public.invitations_guard_update()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('inkey.transicion', true), '') = 'on' then
    return new;
  end if;

  if new.token_hash is distinct from old.token_hash
     or new.rental_id is distinct from old.rental_id
     or new.invited_role is distinct from old.invited_role
     or new.created_by is distinct from old.created_by
     or new.accepted_at is distinct from old.accepted_at
     or new.accepted_by is distinct from old.accepted_by
     or new.expires_at is distinct from old.expires_at then
    raise exception 'De una invitación solo se puede revocar' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger invitations_guard_update_trigger
  before update on public.invitations
  for each row execute function public.invitations_guard_update();

-- ---------------------------------------------------------------- seguridad
alter table public.invitations enable row level security;
alter table public.invitations force row level security;

revoke all on public.invitations from anon, authenticated;
grant select, insert, update on public.invitations to authenticated;

-- La invitación la ven las partes del alquiler. Quien la recibe todavía no es
-- parte: para eso está invitation_preview(), más abajo.
create policy "invitación: la ven las partes del alquiler"
  on public.invitations for select
  to authenticated
  using (
    exists (
      select 1 from public.rentals r
       where r.id = invitations.rental_id
         and (r.tenant_id = (select auth.uid()) or r.owner_id = (select auth.uid()))
    )
  );

create policy "invitación: la crea quien creó el alquiler"
  on public.invitations for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and accepted_at is null
    and revoked_at is null
    and exists (
      select 1 from public.rentals r
       where r.id = rental_id
         and r.created_by = (select auth.uid())
         and r.status = 'pending'
    )
  );

create policy "invitación: la revoca quien la creó"
  on public.invitations for update
  to authenticated
  using (created_by = (select auth.uid()) and accepted_at is null)
  with check (created_by = (select auth.uid()));
