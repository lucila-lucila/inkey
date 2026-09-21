/*
 * Datos de ejemplo para ver la app con algo adentro.
 *
 *   ⚠️  SOLO PARA DESARROLLO. Nunca contra la base de producción: crea
 *       usuarios en auth.users y escribe saltando RLS.
 *
 * Cómo usarlo:
 *   1. pegalo en el SQL Editor de un proyecto de Supabase de prueba, o
 *   2. corré `psql "$DATABASE_URL" -f supabase/seed.sql` contra el local.
 *
 * Crea tres personas y tres alquileres que muestran los estados que importan:
 * uno activo con historial, uno recién invitado y uno terminado con reseñas.
 * Los mails son @ejemplo.test: no existen y no le llega nada a nadie.
 *
 * Es idempotente: si ya está cargado, no duplica nada.
 */

do $$
declare
  v_martina uuid;
  v_jorge   uuid;
  v_paula   uuid;
  v_activo  uuid;
  v_nuevo   uuid;
  v_viejo   uuid;
  v_pago    jsonb;
  v_periodo date;
  v_i       integer;
begin
  if exists (select 1 from auth.users where email = 'martina@ejemplo.test') then
    raise notice 'El seed ya estaba cargado: no hago nada.';
    return;
  end if;

  -- ------------------------------------------------------------- personas
  insert into auth.users (id, email) values
    (gen_random_uuid(), 'martina@ejemplo.test') returning id into v_martina;
  insert into auth.users (id, email) values
    (gen_random_uuid(), 'jorge@ejemplo.test') returning id into v_jorge;
  insert into auth.users (id, email) values
    (gen_random_uuid(), 'paula@ejemplo.test') returning id into v_paula;

  -- El trigger ya les creó el perfil vacío: lo completamos.
  update public.profiles set
    first_name = 'Martina', last_name = 'Rossi', phone = '+54 9 11 5555 1111',
    initial_intent = 'inquilino',
    accepted_terms_at = now(), accepted_privacy_at = now()
   where id = v_martina;

  update public.profiles set
    first_name = 'Jorge', last_name = 'Lema', phone = '+54 9 11 5555 2222',
    initial_intent = 'propietario',
    accepted_terms_at = now(), accepted_privacy_at = now()
   where id = v_jorge;

  update public.profiles set
    first_name = 'Paula', last_name = 'Giménez', phone = '+54 9 11 5555 3333',
    initial_intent = 'propietario',
    accepted_terms_at = now(), accepted_privacy_at = now()
   where id = v_paula;

  -- ---------------------------------------------------------- alquileres
  -- 1. Activo, con un año de historial: es el que se ve mejor en el perfil.
  insert into public.rentals
    (tenant_id, owner_id, created_by, neighborhood_label, full_address,
     start_date, end_date, monthly_amount, currency, due_day,
     adjustment_index, adjustment_every_months, status)
  values
    (v_martina, v_jorge, v_martina, 'Palermo, CABA', 'Gurruchaga 1234, 3° B',
     (current_date - interval '13 months')::date, (current_date + interval '11 months')::date,
     450000, 'ARS', 10, 'ICL', 6, 'active')
  returning id into v_activo;

  -- 2. Recién cargado por el dueño: todavía espera que el inquilino confirme.
  insert into public.rentals
    (tenant_id, owner_id, created_by, neighborhood_label, full_address,
     start_date, end_date, monthly_amount, currency, due_day, status)
  values
    (null, v_paula, v_paula, 'Villa Crespo, CABA', 'Aguirre 890, 2° A',
     current_date::date, (current_date + interval '24 months')::date,
     390000, 'ARS', 5, 'pending')
  returning id into v_nuevo;

  -- 3. Terminado, con reseñas de las dos partes: cuenta como contrato cumplido.
  insert into public.rentals
    (tenant_id, owner_id, created_by, neighborhood_label, full_address,
     start_date, end_date, monthly_amount, currency, due_day, status, ended_at)
  values
    (v_martina, v_paula, v_martina, 'Almagro, CABA', 'Medrano 456, 1° C',
     (current_date - interval '40 months')::date, (current_date - interval '16 months')::date,
     260000, 'ARS', 1, 'ended', now() - interval '16 months')
  returning id into v_viejo;

  /*
   * Los pagos del contrato terminado van directo a la tabla: `payment_report`
   * exige un alquiler activo, y este ya cerró. Es la única parte del seed que
   * escribe a mano, y por eso pone el vencimiento y la numeración explícitos.
   */
  insert into public.payments
    (rental_id, period, due_date, amount, currency, paid_on, status,
     reported_by, reported_at, confirmed_by, confirmed_at, receipt_serial)
  select
    v_viejo,
    date_trunc('month', current_date - make_interval(months => 15 + n))::date,
    (date_trunc('month', current_date - make_interval(months => 15 + n)) + interval '0 day')::date,
    260000, 'ARS',
    (date_trunc('month', current_date - make_interval(months => 15 + n)))::date,
    'confirmed',
    v_martina, now() - make_interval(months => 15 + n),
    v_paula, now() - make_interval(months => 15 + n),
    n
  from generate_series(1, 6) as n;

  /*
   * ------------------------------------------------------------- pagos
   * Van por las funciones de verdad (`payment_report` / `payment_confirm`),
   * no por inserts a mano: así el seed prueba de paso que las reglas del
   * dominio funcionan (vencimiento, puntualidad, numeración del recibo).
   */
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_martina, 'role', 'authenticated')::text, false);

  for v_i in 1..12 loop
    v_periodo := date_trunc('month', current_date - make_interval(months => v_i))::date;
    v_pago := public.payment_report(
      v_activo, v_periodo, 450000,
      -- Casi siempre en fecha; un par de meses, dos días tarde.
      (v_periodo + make_interval(days => case when v_i in (4, 9) then 11 else 6 end))::date
    );

    if (v_pago->>'ok')::boolean then
      perform set_config('request.jwt.claims',
        json_build_object('sub', v_jorge, 'role', 'authenticated')::text, false);
      perform public.payment_confirm((v_pago->>'payment_id')::uuid);
      perform set_config('request.jwt.claims',
        json_build_object('sub', v_martina, 'role', 'authenticated')::text, false);
    end if;
  end loop;

  -- El mes en curso: reportado y esperando que Jorge lo confirme.
  v_pago := public.payment_report(
    v_activo, date_trunc('month', current_date)::date, 450000, current_date
  );

  -- ------------------------------------------------------------ reseñas
  perform public.review_submit(
    v_viejo,
    'Paula resolvió todo rápido y devolvió el depósito sin vueltas.',
    array['resolvio_arreglos_rapido', 'devolvio_el_deposito']
  );

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_paula, 'role', 'authenticated')::text, false);
  perform public.review_submit(
    v_viejo,
    'Martina pagó siempre en fecha y devolvió el departamento impecable.',
    array['siempre_al_dia', 'cuido_la_propiedad']
  );

  perform set_config('request.jwt.claims', '', false);

  raise notice 'Seed listo. Entrá con martina@ejemplo.test (inquilina) o jorge@ejemplo.test (dueño).';
end;
$$;
