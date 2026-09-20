-- Aceptar o rechazar una invitación.
--
-- Quien recibe el link todavía NO es parte del alquiler: RLS, con razón, no lo
-- deja ver nada. Por eso estas tres funciones son security definer y devuelven
-- exactamente lo necesario, ni un campo más.
--
-- Reciben el HASH del token, no el token: el token en claro se queda en el
-- servidor de la app y nunca llega a la base ni a sus logs.

/*
 * Resumen de la invitación para la pantalla /invitacion/[token].
 * Muestra la dirección completa a propósito: sin ella, el dueño no puede
 * reconocer si la propiedad es suya. El link es la credencial.
 */
create or replace function public.invitation_preview(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.invitations;
  v_rental public.rentals;
  v_quien public.profiles;
  v_estado text;
begin
  select * into v_inv from public.invitations where token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('estado', 'inexistente');
  end if;

  select * into v_rental from public.rentals where id = v_inv.rental_id;
  select * into v_quien from public.profiles where id = v_inv.created_by;

  v_estado := case
    when v_inv.accepted_at is not null then 'usada'
    when v_inv.revoked_at is not null then 'revocada'
    when v_inv.expires_at <= now() then 'vencida'
    when v_rental.status <> 'pending' then 'revocada'
    else 'valida'
  end;

  return jsonb_build_object(
    'estado', v_estado,
    'rol_invitado', v_inv.invited_role,
    'vence', v_inv.expires_at,
    'invita', jsonb_build_object(
      'nombre', coalesce(v_quien.first_name, ''),
      'inicial_apellido', left(coalesce(v_quien.last_name, ''), 1)
    ),
    'alquiler', jsonb_build_object(
      'barrio', v_rental.neighborhood_label,
      'direccion', v_rental.full_address,
      'desde', v_rental.start_date,
      'hasta', v_rental.end_date,
      'monto', v_rental.monthly_amount,
      'moneda', v_rental.currency,
      'dia_vencimiento', v_rental.due_day,
      'indice_ajuste', v_rental.adjustment_index,
      'ajuste_cada_meses', v_rental.adjustment_every_months
    )
  );
end;
$$;

revoke all on function public.invitation_preview(text) from public;
-- Anon también: la pantalla se ve antes de entrar con el mail.
grant execute on function public.invitation_preview(text) to anon, authenticated;

/*
 * Aceptar. Ocupa el lugar libre del alquiler y lo pasa a active.
 * Devuelve { ok, error?, rental_id? } en vez de reventar, para poder mostrar
 * un mensaje entendible.
 */
create or replace function public.invitation_accept(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.invitations;
  v_rental public.rentals;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'sin_sesion');
  end if;

  select * into v_inv
    from public.invitations
   where token_hash = p_token_hash
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'inexistente');
  end if;
  if v_inv.accepted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'usada');
  end if;
  if v_inv.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'revocada');
  end if;
  if v_inv.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'vencida');
  end if;

  select * into v_rental from public.rentals where id = v_inv.rental_id for update;

  if v_rental.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'ya_no_disponible');
  end if;
  -- Nadie acepta su propia invitación: sería un alquiler consigo mismo.
  if v_rental.created_by = v_uid or v_rental.tenant_id = v_uid or v_rental.owner_id = v_uid then
    return jsonb_build_object('ok', false, 'error', 'sos_vos');
  end if;

  perform set_config('inkey.transicion', 'on', true);

  if v_inv.invited_role = 'owner' then
    if v_rental.owner_id is not null then
      perform set_config('inkey.transicion', 'off', true);
      return jsonb_build_object('ok', false, 'error', 'ya_no_disponible');
    end if;
    update public.rentals
       set owner_id = v_uid, status = 'active', activated_at = now()
     where id = v_rental.id;
  else
    if v_rental.tenant_id is not null then
      perform set_config('inkey.transicion', 'off', true);
      return jsonb_build_object('ok', false, 'error', 'ya_no_disponible');
    end if;
    update public.rentals
       set tenant_id = v_uid, status = 'active', activated_at = now()
     where id = v_rental.id;
  end if;

  update public.invitations
     set accepted_at = now(), accepted_by = v_uid
   where id = v_inv.id;

  perform set_config('inkey.transicion', 'off', true);

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'invitacion.aceptada', 'rental', v_rental.id,
          jsonb_build_object('invitation_id', v_inv.id, 'rol', v_inv.invited_role));

  return jsonb_build_object('ok', true, 'rental_id', v_rental.id);
end;
$$;

revoke all on function public.invitation_accept(text) from public, anon;
grant execute on function public.invitation_accept(text) to authenticated;

/*
 * "No soy el dueño de esta propiedad." El alquiler pasa a rejected y se le
 * avisa a quien invitó.
 * No pedimos sesión: quien recibió el link por error tiene que poder decir que
 * no sin crearse una cuenta. Es reversible — la otra parte puede volver a
 * cargar el alquiler— y evita que quede colgado para siempre.
 */
create or replace function public.invitation_reject(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.invitations;
  v_rental public.rentals;
begin
  select * into v_inv from public.invitations where token_hash = p_token_hash for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'inexistente');
  end if;
  if v_inv.accepted_at is not null then
    return jsonb_build_object('ok', false, 'error', 'usada');
  end if;
  if v_inv.revoked_at is not null then
    return jsonb_build_object('ok', false, 'error', 'revocada');
  end if;
  if v_inv.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'vencida');
  end if;

  select * into v_rental from public.rentals where id = v_inv.rental_id for update;

  if v_rental.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'ya_no_disponible');
  end if;

  perform set_config('inkey.transicion', 'on', true);

  update public.rentals
     set status = 'rejected', rejected_at = now()
   where id = v_rental.id;

  update public.invitations
     set revoked_at = now()
   where id = v_inv.id;

  perform set_config('inkey.transicion', 'off', true);

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'invitacion.rechazada', 'rental', v_rental.id,
          jsonb_build_object('invitation_id', v_inv.id));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.invitation_reject(text) from public;
grant execute on function public.invitation_reject(text) to anon, authenticated;
