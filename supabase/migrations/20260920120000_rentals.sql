-- Alquileres. El rol no vive en la cuenta: en un alquiler sos inquilino y en
-- otro sos dueño. Por eso tenant_id y owner_id son dos columnas y las dos
-- pueden estar vacías hasta que la otra parte acepte la invitación.

create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references auth.users (id) on delete set null,
  owner_id uuid references auth.users (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,

  -- Lo único de la dirección que puede verse en el perfil público.
  neighborhood_label text not null check (char_length(btrim(neighborhood_label)) between 2 and 60),
  -- Privada: nunca sale del alquiler.
  full_address text not null check (char_length(btrim(full_address)) between 5 and 200),

  start_date date not null,
  end_date date,
  monthly_amount numeric(12, 2) not null check (monthly_amount > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  -- Si el mes no tiene ese día (31 en febrero), vence el último día del mes.
  due_day smallint not null check (due_day between 1 and 31),
  adjustment_index text check (char_length(btrim(adjustment_index)) between 1 and 40),
  adjustment_every_months smallint check (adjustment_every_months between 1 and 60),
  contract_path text,

  status text not null default 'pending'
    check (status in ('pending', 'active', 'pending_end', 'ended', 'rejected')),
  activated_at timestamptz,
  rejected_at timestamptz,
  -- Fin de contrato en dos pasos: uno marca, el otro confirma (Fase 5).
  end_requested_by uuid references auth.users (id) on delete set null,
  end_requested_at timestamptz,
  ended_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Nadie alquila consigo mismo.
  constraint rentals_partes_distintas
    check (tenant_id is null or owner_id is null or tenant_id <> owner_id),
  -- Quien lo creó es una de las dos partes.
  constraint rentals_creador_es_parte
    check (created_by = tenant_id or created_by = owner_id),
  constraint rentals_fechas_coherentes
    check (end_date is null or end_date >= start_date),
  constraint rentals_ajuste_completo
    check ((adjustment_index is null) = (adjustment_every_months is null))
);

comment on table public.rentals is
  'Un alquiler entre un inquilino y un dueño. Queda pending hasta que la otra parte acepta.';
comment on column public.rentals.neighborhood_label is
  'Barrio y ciudad. Es lo único de la ubicación que puede verse en el perfil público.';
comment on column public.rentals.due_day is
  'Día de vencimiento. Si el mes no lo tiene, vence el último día del mes.';

create index rentals_tenant on public.rentals (tenant_id) where tenant_id is not null;
create index rentals_owner on public.rentals (owner_id) where owner_id is not null;

create trigger rentals_set_updated_at
  before update on public.rentals
  for each row execute function public.set_updated_at();

/*
 * Las transiciones de estado y el alta de la contraparte NO se hacen con un
 * update suelto: pasan por funciones security definer que validan todo. Este
 * trigger cierra esa puerta salvo que la función avise que es ella.
 *
 * Además fija qué se puede editar y cuándo:
 *   - quien creó el alquiler, mientras nadie aceptó, corrige cualquier dato;
 *   - después, lo único que cambia es el contrato adjunto.
 */
create or replace function public.rentals_guard_update()
returns trigger
language plpgsql
as $$
declare
  v_comparable public.rentals;
begin
  if coalesce(current_setting('inkey.transicion', true), '') = 'on' then
    return new;
  end if;

  if new.tenant_id is distinct from old.tenant_id
     or new.owner_id is distinct from old.owner_id
     or new.created_by is distinct from old.created_by
     or new.status is distinct from old.status then
    raise exception 'Las partes y el estado del alquiler no se editan a mano'
      using errcode = '42501';
  end if;

  if old.created_by = (select auth.uid()) and old.status = 'pending' then
    return new;
  end if;

  -- Fuera de ese caso, comparamos todo salvo el contrato: si cambió algo más,
  -- no pasa.
  v_comparable := new;
  v_comparable.contract_path := old.contract_path;
  v_comparable.updated_at := old.updated_at;

  if v_comparable is distinct from old then
    raise exception 'De un alquiler ya confirmado solo se puede adjuntar el contrato'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger rentals_guard_update_trigger
  before update on public.rentals
  for each row execute function public.rentals_guard_update();

-- ---------------------------------------------------------------- seguridad
alter table public.rentals enable row level security;
alter table public.rentals force row level security;

revoke all on public.rentals from anon, authenticated;
grant select, insert, update, delete on public.rentals to authenticated;

-- Solo las dos partes ven el alquiler. Un tercero no sabe ni que existe.
create policy "alquiler: lo ven sus dos partes"
  on public.rentals for select
  to authenticated
  using (tenant_id = (select auth.uid()) or owner_id = (select auth.uid()));

-- Se crea siempre ocupando uno de los dos lugares y dejando el otro libre
-- para quien reciba la invitación.
create policy "alquiler: lo crea una de las partes"
  on public.rentals for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and status = 'pending'
    and (
      (tenant_id = (select auth.uid()) and owner_id is null)
      or (owner_id = (select auth.uid()) and tenant_id is null)
    )
  );

-- Mientras nadie aceptó, quien lo creó puede corregir los datos.
create policy "alquiler: lo corrige quien lo creó, antes de que acepten"
  on public.rentals for update
  to authenticated
  using (created_by = (select auth.uid()) and status = 'pending')
  with check (created_by = (select auth.uid()) and status = 'pending');

-- Las dos partes pueden adjuntar el contrato en cualquier momento: el trigger
-- de arriba se encarga de que sea lo único que puedan tocar.
create policy "alquiler: las partes adjuntan el contrato"
  on public.rentals for update
  to authenticated
  using (
    status in ('pending', 'active')
    and (tenant_id = (select auth.uid()) or owner_id = (select auth.uid()))
  )
  with check (
    status in ('pending', 'active')
    and (tenant_id = (select auth.uid()) or owner_id = (select auth.uid()))
  );

-- Y también puede darlo de baja si lo cargó por error, o si la otra parte
-- dijo que no era suya.
create policy "alquiler: lo cancela quien lo creó, si nadie lo confirmó"
  on public.rentals for delete
  to authenticated
  using (created_by = (select auth.uid()) and status in ('pending', 'rejected'));

-- ------------------------------------------------- perfil de la contraparte
-- Con quien compartís un alquiler ve tu nombre y tu celular: los necesita para
-- saber a quién le está confirmando un pago y cómo avisarle. Nadie más.
create or replace function public.comparte_alquiler_con(p_otro uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.rentals r
     where (r.tenant_id = (select auth.uid()) and r.owner_id = p_otro)
        or (r.owner_id = (select auth.uid()) and r.tenant_id = p_otro)
  );
$$;

revoke all on function public.comparte_alquiler_con(uuid) from public, anon;
grant execute on function public.comparte_alquiler_con(uuid) to authenticated;

create policy "perfil de la contraparte: lectura"
  on public.profiles for select
  to authenticated
  using (public.comparte_alquiler_con(id));
