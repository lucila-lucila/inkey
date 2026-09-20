-- Pagos mensuales.
--
-- Dos decisiones que sostienen todo lo demás:
--
-- 1. `due_date` es una FOTO del vencimiento al momento de crear el período.
--    Si mañana se edita el día de vencimiento del alquiler, la puntualidad de
--    los pagos viejos no cambia retroactivamente.
-- 2. Ni el vencimiento ni la moneda los manda el cliente: los calcula la
--    función a partir del alquiler. Si no, cualquiera podría reportar un pago
--    "en fecha" eligiendo su propio vencimiento.
--
-- Por eso la tabla no tiene políticas de INSERT ni UPDATE: todo pasa por las
-- funciones de más abajo, que validan quién es quién.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,

  -- Siempre el día 1 del mes: el período es el mes, no una fecha suelta.
  period date not null check (period = date_trunc('month', period)::date),
  due_date date not null,

  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  paid_on date not null,

  receipt_path text,
  receipt_mime text,
  receipt_size_bytes integer check (receipt_size_bytes > 0),

  status text not null default 'reported'
    check (status in ('reported', 'confirmed', 'not_received')),

  reported_at timestamptz not null default now(),
  reported_by uuid not null references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id) on delete set null,
  not_received_at timestamptz,
  -- Privada entre las partes: nunca sale al perfil público.
  owner_note text check (char_length(owner_note) <= 500),
  -- Numeración del recibo dentro del alquiler, al confirmar.
  receipt_serial integer,

  -- "En fecha" es una propiedad del pago, no algo que recalcule el código.
  on_time boolean generated always as (paid_on <= due_date) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (rental_id, period)
);

comment on table public.payments is
  'Un pago por mes y por alquiler. Solo cuenta para el historial cuando el dueño lo confirma.';
comment on column public.payments.due_date is
  'Foto del vencimiento al crear el período: no cambia si después se edita el alquiler.';
comment on column public.payments.owner_note is
  'Nota privada del dueño (por ejemplo, por qué dice que no le llegó). Nunca es pública.';
comment on column public.payments.on_time is
  'paid_on <= due_date. La puntualidad pública además exige status = confirmed.';

create index payments_rental on public.payments (rental_id, period desc);
create index payments_pendientes on public.payments (rental_id) where status = 'reported';

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- seguridad
alter table public.payments enable row level security;
alter table public.payments force row level security;

revoke all on public.payments from anon, authenticated;
-- Solo lectura: escribir es siempre a través de las funciones.
grant select on public.payments to authenticated;

create policy "pago: lo ven las dos partes del alquiler"
  on public.payments for select
  to authenticated
  using (
    exists (
      select 1 from public.rentals r
       where r.id = payments.rental_id
         and (r.tenant_id = (select auth.uid()) or r.owner_id = (select auth.uid()))
    )
  );

-- ----------------------------------------------------------------- funciones

/** Vencimiento de un período: si el mes no tiene ese día, el último del mes. */
create or replace function public.vencimiento_del_periodo(p_periodo date, p_dia smallint)
returns date
language sql
immutable
as $$
  select p_periodo
       + (least(p_dia, extract(day from (p_periodo + interval '1 month - 1 day'))::int) - 1)
       * interval '1 day';
$$;

/*
 * El inquilino reporta que pagó.
 * Sirve también para volver a reportar un pago que el dueño marcó como no
 * recibido: ese ida y vuelta es normal y no deja marca negativa en ningún lado.
 */
create or replace function public.payment_report(
  p_rental_id uuid,
  p_period date,
  p_amount numeric,
  p_paid_on date,
  p_receipt_path text default null,
  p_receipt_mime text default null,
  p_receipt_size_bytes integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rental public.rentals;
  v_periodo date := date_trunc('month', p_period)::date;
  v_vence date;
  v_existente public.payments;
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'sin_sesion');
  end if;

  select * into v_rental from public.rentals where id = p_rental_id for update;

  if not found or v_rental.tenant_id is distinct from v_uid then
    -- No decimos "no sos el inquilino" para no confirmar que el alquiler existe.
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;
  if v_rental.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'alquiler_inactivo');
  end if;

  -- El período tiene que caer dentro del contrato y no ser futuro.
  if v_periodo < date_trunc('month', v_rental.start_date)::date then
    return jsonb_build_object('ok', false, 'error', 'periodo_fuera_del_contrato');
  end if;
  if v_rental.end_date is not null
     and v_periodo > date_trunc('month', v_rental.end_date)::date then
    return jsonb_build_object('ok', false, 'error', 'periodo_fuera_del_contrato');
  end if;
  if v_periodo > date_trunc('month', current_date)::date then
    return jsonb_build_object('ok', false, 'error', 'periodo_futuro');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', false, 'error', 'monto_invalido');
  end if;
  if p_paid_on is null or p_paid_on > current_date then
    return jsonb_build_object('ok', false, 'error', 'fecha_futura');
  end if;
  if p_paid_on < v_periodo - interval '2 months' then
    return jsonb_build_object('ok', false, 'error', 'fecha_muy_vieja');
  end if;

  v_vence := public.vencimiento_del_periodo(v_periodo, v_rental.due_day);

  select * into v_existente
    from public.payments
   where rental_id = p_rental_id and period = v_periodo
     for update;

  if found then
    -- Solo se puede volver a reportar lo que el dueño dijo no haber recibido.
    if v_existente.status <> 'not_received' then
      return jsonb_build_object('ok', false, 'error', 'ya_reportado', 'payment_id', v_existente.id);
    end if;

    update public.payments
       set amount = p_amount,
           paid_on = p_paid_on,
           receipt_path = coalesce(p_receipt_path, receipt_path),
           receipt_mime = coalesce(p_receipt_mime, receipt_mime),
           receipt_size_bytes = coalesce(p_receipt_size_bytes, receipt_size_bytes),
           status = 'reported',
           reported_at = now(),
           reported_by = v_uid,
           not_received_at = null,
           owner_note = null
     where id = v_existente.id;

    v_id := v_existente.id;
  else
    insert into public.payments
      (rental_id, period, due_date, amount, currency, paid_on,
       receipt_path, receipt_mime, receipt_size_bytes, reported_by)
    values
      (p_rental_id, v_periodo, v_vence, p_amount, v_rental.currency, p_paid_on,
       p_receipt_path, p_receipt_mime, p_receipt_size_bytes, v_uid)
    returning id into v_id;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'pago.reportado', 'payment', v_id,
          jsonb_build_object('rental_id', p_rental_id, 'periodo', v_periodo));

  return jsonb_build_object('ok', true, 'payment_id', v_id);
end;
$$;

revoke all on function public.payment_report(uuid, date, numeric, date, text, text, integer)
  from public, anon;
grant execute on function public.payment_report(uuid, date, numeric, date, text, text, integer)
  to authenticated;

/*
 * El dueño confirma que lo recibió. Es LA acción que hace que un mes cuente,
 * así que se verifica acá, en el servidor, no en la pantalla.
 */
create or replace function public.payment_confirm(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pago public.payments;
  v_rental public.rentals;
  v_serial integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'sin_sesion');
  end if;

  select * into v_pago from public.payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;

  select * into v_rental from public.rentals where id = v_pago.rental_id;
  if v_rental.owner_id is distinct from v_uid then
    return jsonb_build_object('ok', false, 'error', 'no_sos_el_dueño');
  end if;
  if v_pago.status = 'confirmed' then
    return jsonb_build_object('ok', true, 'payment_id', v_pago.id, 'ya_estaba', true);
  end if;

  select coalesce(max(receipt_serial), 0) + 1 into v_serial
    from public.payments where rental_id = v_pago.rental_id;

  update public.payments
     set status = 'confirmed',
         confirmed_at = now(),
         confirmed_by = v_uid,
         not_received_at = null,
         receipt_serial = coalesce(v_pago.receipt_serial, v_serial)
   where id = v_pago.id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'pago.confirmado', 'payment', v_pago.id,
          jsonb_build_object('rental_id', v_pago.rental_id, 'periodo', v_pago.period));

  return jsonb_build_object('ok', true, 'payment_id', v_pago.id);
end;
$$;

revoke all on function public.payment_confirm(uuid) from public, anon;
grant execute on function public.payment_confirm(uuid) to authenticated;

/*
 * "Todavía no me llegó."
 * Queda entre las dos partes: no aparece en el perfil público ni afecta
 * ninguna métrica. El inquilino puede volver a reportar cuando se aclare.
 */
create or replace function public.payment_not_received(p_payment_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_pago public.payments;
  v_rental public.rentals;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'sin_sesion');
  end if;

  select * into v_pago from public.payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;

  select * into v_rental from public.rentals where id = v_pago.rental_id;
  if v_rental.owner_id is distinct from v_uid then
    return jsonb_build_object('ok', false, 'error', 'no_sos_el_dueño');
  end if;
  if v_pago.status = 'confirmed' then
    return jsonb_build_object('ok', false, 'error', 'ya_confirmado');
  end if;

  update public.payments
     set status = 'not_received',
         not_received_at = now(),
         owner_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = v_pago.id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'pago.no_recibido', 'payment', v_pago.id,
          jsonb_build_object('rental_id', v_pago.rental_id, 'periodo', v_pago.period));

  return jsonb_build_object('ok', true, 'payment_id', v_pago.id);
end;
$$;

revoke all on function public.payment_not_received(uuid, text) from public, anon;
grant execute on function public.payment_not_received(uuid, text) to authenticated;
