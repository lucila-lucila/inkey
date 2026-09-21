-- Notificaciones: avisos por mail y recordatorios.
--
-- Dos piezas:
--   * `notifications`, que es el registro de lo que se mandó. Su clave
--     `dedupe_key` es lo que impide que un cron que corre dos veces mande el
--     mismo aviso dos veces.
--   * `action_tokens`, los links firmados que le llegan al dueño para
--     confirmar un pago sin tener que entrar. Son de un solo uso, duran poco y
--     sirven para UNA acción sobre UN pago: un mail reenviado no le abre la
--     cuenta a nadie.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  -- Lo que evita el aviso repetido. Incluye el destinatario y el hecho.
  dedupe_key text not null unique,
  rental_id uuid references public.rentals (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete cascade,
  recipient_id uuid references auth.users (id) on delete set null,
  -- Solo cuando el destinatario todavía no tiene cuenta (una invitación).
  recipient_email extensions.citext,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Qué avisos se mandaron. dedupe_key impide mandar dos veces lo mismo.';

create index notifications_pago on public.notifications (payment_id, type);

alter table public.notifications enable row level security;
alter table public.notifications force row level security;
revoke all on public.notifications from anon, authenticated;

create table public.action_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  -- Para qué sirve este token, y para nada más.
  purpose text not null check (purpose in ('confirm_payment')),
  payment_id uuid not null references public.payments (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.action_tokens is
  'Links firmados de los mails. Un solo uso, vida corta y una sola acción.';

create index action_tokens_pago on public.action_tokens (payment_id) where used_at is null;

alter table public.action_tokens enable row level security;
alter table public.action_tokens force row level security;
revoke all on public.action_tokens from anon, authenticated;

-- ------------------------------------------------ lo que el cron necesita

/*
 * Pagos reportados que el dueño todavía no respondió, pasados N días.
 * Devuelve lo mínimo para armar el aviso.
 */
create or replace function public.pagos_sin_respuesta(p_dias integer default 3)
returns table (
  payment_id uuid,
  rental_id uuid,
  owner_id uuid,
  tenant_id uuid,
  period date,
  amount numeric,
  currency text,
  paid_on date,
  neighborhood_label text,
  reported_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, r.id, r.owner_id, r.tenant_id, p.period, p.amount, p.currency,
         p.paid_on, r.neighborhood_label, p.reported_at
    from public.payments p
    join public.rentals r on r.id = p.rental_id
   where p.status = 'reported'
     and r.owner_id is not null
     and p.reported_at <= now() - make_interval(days => p_dias);
$$;

revoke all on function public.pagos_sin_respuesta(integer) from public, anon, authenticated;
grant execute on function public.pagos_sin_respuesta(integer) to service_role;

/*
 * Reserva el envío de un aviso. Devuelve true solo la primera vez: si el cron
 * corre dos veces, la segunda no manda nada.
 */
create or replace function public.notification_claim(
  p_dedupe_key text,
  p_type text,
  p_rental_id uuid default null,
  p_payment_id uuid default null,
  p_recipient_id uuid default null,
  p_recipient_email text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications
    (type, dedupe_key, rental_id, payment_id, recipient_id, recipient_email)
  values
    (p_type, p_dedupe_key, p_rental_id, p_payment_id, p_recipient_id, p_recipient_email);
  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.notification_claim(text, text, uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.notification_claim(text, text, uuid, uuid, uuid, text)
  to service_role;

/** Marca el aviso como enviado, o guarda por qué falló. */
create or replace function public.notification_settle(p_dedupe_key text, p_error text default null)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.notifications
     set sent_at = case when p_error is null then now() else null end,
         error = p_error
   where dedupe_key = p_dedupe_key;
$$;

revoke all on function public.notification_settle(text, text) from public, anon, authenticated;
grant execute on function public.notification_settle(text, text) to service_role;

-- -------------------------------------- confirmar desde el mail, sin sesión

/*
 * El link del mail confirma UN pago y nada más.
 *
 * No abre sesión: quien tenga el link puede responder ese pago, igual que
 * quien tenga la casilla del dueño. Por eso dura poco, se usa una sola vez y
 * queda registrado en la bitácora como hecho desde el mail.
 */
create or replace function public.payment_confirm_with_token(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token public.action_tokens;
  v_pago public.payments;
  v_rental public.rentals;
  v_serial integer;
begin
  select * into v_token
    from public.action_tokens
   where token_hash = p_token_hash and purpose = 'confirm_payment'
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'inexistente');
  end if;
  if v_token.used_at is not null then
    return jsonb_build_object('ok', false, 'error', 'usado');
  end if;
  if v_token.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'vencido');
  end if;

  select * into v_pago from public.payments where id = v_token.payment_id for update;
  select * into v_rental from public.rentals where id = v_pago.rental_id;

  if v_pago.status = 'confirmed' then
    update public.action_tokens set used_at = now() where id = v_token.id;
    return jsonb_build_object('ok', true, 'payment_id', v_pago.id, 'ya_estaba', true);
  end if;

  select coalesce(max(receipt_serial), 0) + 1 into v_serial
    from public.payments where rental_id = v_pago.rental_id;

  update public.payments
     set status = 'confirmed',
         confirmed_at = now(),
         confirmed_by = v_rental.owner_id,
         not_received_at = null,
         receipt_serial = coalesce(v_pago.receipt_serial, v_serial)
   where id = v_pago.id;

  update public.action_tokens set used_at = now() where id = v_token.id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_rental.owner_id, 'pago.confirmado', 'payment', v_pago.id,
          jsonb_build_object('rental_id', v_pago.rental_id, 'periodo', v_pago.period, 'via', 'mail'));

  return jsonb_build_object('ok', true, 'payment_id', v_pago.id);
end;
$$;

revoke all on function public.payment_confirm_with_token(text) from public;
grant execute on function public.payment_confirm_with_token(text) to anon, authenticated;

/** "Todavía no me llegó", también desde el mail. */
create or replace function public.payment_not_received_with_token(
  p_token_hash text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_token public.action_tokens;
  v_pago public.payments;
  v_rental public.rentals;
begin
  select * into v_token
    from public.action_tokens
   where token_hash = p_token_hash and purpose = 'confirm_payment'
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'inexistente');
  end if;
  if v_token.used_at is not null then
    return jsonb_build_object('ok', false, 'error', 'usado');
  end if;
  if v_token.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'vencido');
  end if;

  select * into v_pago from public.payments where id = v_token.payment_id for update;
  select * into v_rental from public.rentals where id = v_pago.rental_id;

  if v_pago.status = 'confirmed' then
    return jsonb_build_object('ok', false, 'error', 'ya_confirmado');
  end if;

  update public.payments
     set status = 'not_received',
         not_received_at = now(),
         owner_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = v_pago.id;

  update public.action_tokens set used_at = now() where id = v_token.id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_rental.owner_id, 'pago.no_recibido', 'payment', v_pago.id,
          jsonb_build_object('rental_id', v_pago.rental_id, 'periodo', v_pago.period, 'via', 'mail'));

  return jsonb_build_object('ok', true, 'payment_id', v_pago.id);
end;
$$;

revoke all on function public.payment_not_received_with_token(text, text) from public;
grant execute on function public.payment_not_received_with_token(text, text) to anon, authenticated;

/*
 * Lo que muestra la pantalla del link: el resumen del pago, sin datos de más.
 * No consume el token: eso pasa recién cuando la persona responde.
 */
create or replace function public.payment_token_preview(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_token public.action_tokens;
  v_pago public.payments;
  v_rental public.rentals;
  v_inquilino public.profiles;
begin
  select * into v_token
    from public.action_tokens
   where token_hash = p_token_hash and purpose = 'confirm_payment';

  if not found then
    return jsonb_build_object('estado', 'inexistente');
  end if;

  select * into v_pago from public.payments where id = v_token.payment_id;
  select * into v_rental from public.rentals where id = v_pago.rental_id;
  select * into v_inquilino from public.profiles where id = v_rental.tenant_id;

  return jsonb_build_object(
    'estado', case
      when v_token.used_at is not null then 'usado'
      when v_token.expires_at <= now() then 'vencido'
      when v_pago.status = 'confirmed' then 'ya_confirmado'
      else 'valido'
    end,
    'periodo', v_pago.period,
    'monto', v_pago.amount,
    'moneda', v_pago.currency,
    'pagado_el', v_pago.paid_on,
    'vencia', v_pago.due_date,
    'barrio', v_rental.neighborhood_label,
    'inquilino', jsonb_build_object(
      'nombre', coalesce(v_inquilino.first_name, ''),
      'inicial_apellido', left(coalesce(v_inquilino.last_name, ''), 1)
    )
  );
end;
$$;

revoke all on function public.payment_token_preview(text) from public;
grant execute on function public.payment_token_preview(text) to anon, authenticated;
