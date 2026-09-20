-- Fin de contrato y reseñas.
--
-- Dos ideas gobiernan esta tabla:
--
-- 1. Nadie escribe condicionado por lo que dijo el otro. Una reseña se guarda
--    enseguida pero no se publica hasta que las dos estén escritas o hasta que
--    pasen 14 días del fin del contrato, lo que ocurra primero (como Airbnb).
-- 2. Las etiquetas viven en una tabla, no en el código: las del inquilino y
--    las del dueño son distintas y queremos poder sumar o sacar sin migrar.

-- ------------------------------------------------- catálogo de etiquetas

create table public.review_tag_defs (
  code text primary key,
  -- Hacia dónde va la reseña que puede usar esta etiqueta.
  direction text not null check (direction in ('tenant_to_owner', 'owner_to_tenant')),
  label text not null,
  orden smallint not null default 0,
  active boolean not null default true
);

comment on table public.review_tag_defs is
  'Etiquetas rápidas de las reseñas. Son siempre afirmaciones positivas.';

insert into public.review_tag_defs (code, direction, label, orden) values
  -- Lo que el dueño puede decir de su inquilino.
  ('siempre_al_dia', 'owner_to_tenant', 'Siempre al día', 1),
  ('cuido_la_propiedad', 'owner_to_tenant', 'Cuidó la propiedad', 2),
  ('aviso_los_problemas', 'owner_to_tenant', 'Avisó los problemas a tiempo', 3),
  ('buena_comunicacion_inquilino', 'owner_to_tenant', 'Fácil de contactar', 4),
  ('entrego_todo_en_orden', 'owner_to_tenant', 'Entregó todo en orden', 5),
  -- Lo que el inquilino puede decir de su dueño.
  ('resolvio_arreglos_rapido', 'tenant_to_owner', 'Resolvió arreglos rápido', 1),
  ('devolvio_el_deposito', 'tenant_to_owner', 'Devolvió el depósito', 2),
  ('respeto_lo_acordado', 'tenant_to_owner', 'Respetó lo acordado', 3),
  ('buena_comunicacion_dueno', 'tenant_to_owner', 'Fácil de contactar', 4),
  ('ajustes_claros', 'tenant_to_owner', 'Los ajustes, siempre claros', 5);

alter table public.review_tag_defs enable row level security;
revoke all on public.review_tag_defs from anon, authenticated;
grant select on public.review_tag_defs to anon, authenticated;

-- El catálogo sí es público: son las opciones del formulario.
create policy "etiquetas: las ve cualquiera"
  on public.review_tag_defs for select
  to anon, authenticated
  using (active);

-- ------------------------------------------------------------- reseñas

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete set null,
  subject_id uuid not null references auth.users (id) on delete set null,
  direction text not null check (direction in ('tenant_to_owner', 'owner_to_tenant')),
  text text check (char_length(btrim(text)) <= 500),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  -- Null hasta que se publique: hasta entonces solo la ve quien la escribió.
  published_at timestamptz,

  -- Una reseña por persona y por alquiler.
  unique (rental_id, author_id),
  constraint reviews_partes_distintas check (author_id <> subject_id),
  constraint reviews_algo_que_decir check (
    coalesce(btrim(text), '') <> '' or array_length(tags, 1) > 0
  )
);

comment on table public.reviews is
  'Reseñas de fin de contrato, en las dos direcciones. Se publican juntas.';
comment on column public.reviews.published_at is
  'Se completa cuando las dos reseñas están escritas o a los 14 días del fin.';

create index reviews_sujeto on public.reviews (subject_id, published_at desc);
create index reviews_alquiler on public.reviews (rental_id);

-- Una reseña no se edita ni se borra: se escribe una vez.
create or replace function public.reviews_guard_update()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('inkey.transicion', true), '') = 'on' then
    return new;
  end if;
  raise exception 'Una reseña no se edita' using errcode = '42501';
end;
$$;

create trigger reviews_guard_update_trigger
  before update on public.reviews
  for each row execute function public.reviews_guard_update();

alter table public.reviews enable row level security;
alter table public.reviews force row level security;

revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;

-- Cada quien ve las suyas (escritas por sí) y las publicadas sobre sí.
-- Las del otro, antes de publicarse, no: de eso se trata.
create policy "reseña: la propia siempre; la ajena, una vez publicada"
  on public.reviews for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or (published_at is not null and subject_id = (select auth.uid()))
  );

-- Escribir pasa por la función de abajo, que valida el estado del alquiler
-- y decide si ya se pueden publicar las dos.

-- ------------------------------------------------------ fin de contrato

/*
 * "Terminó el contrato". Lo marca cualquiera de las dos partes y lo confirma
 * la otra: que una sola persona pueda cerrar un alquiler compartido sería
 * darle la última palabra sobre el historial del otro.
 */
create or replace function public.rental_request_end(p_rental_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rental public.rentals;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'sin_sesion');
  end if;

  select * into v_rental from public.rentals where id = p_rental_id for update;

  if not found or (v_rental.tenant_id is distinct from v_uid and v_rental.owner_id is distinct from v_uid) then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;
  if v_rental.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'no_esta_activo');
  end if;

  perform set_config('inkey.transicion', 'on', true);
  update public.rentals
     set status = 'pending_end', end_requested_by = v_uid, end_requested_at = now()
   where id = p_rental_id;
  perform set_config('inkey.transicion', 'off', true);

  insert into public.audit_log (actor_id, action, entity_type, entity_id)
  values (v_uid, 'alquiler.fin_propuesto', 'rental', p_rental_id);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.rental_request_end(uuid) from public, anon;
grant execute on function public.rental_request_end(uuid) to authenticated;

/** La otra parte confirma: recién ahí el alquiler termina. */
create or replace function public.rental_confirm_end(p_rental_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rental public.rentals;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'sin_sesion');
  end if;

  select * into v_rental from public.rentals where id = p_rental_id for update;

  if not found or (v_rental.tenant_id is distinct from v_uid and v_rental.owner_id is distinct from v_uid) then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;
  if v_rental.status <> 'pending_end' then
    return jsonb_build_object('ok', false, 'error', 'no_esta_terminando');
  end if;
  -- Quien lo propuso no se lo confirma a sí mismo.
  if v_rental.end_requested_by = v_uid then
    return jsonb_build_object('ok', false, 'error', 'lo_propusiste_vos');
  end if;

  perform set_config('inkey.transicion', 'on', true);
  update public.rentals
     set status = 'ended',
         ended_at = now(),
         -- El contrato termina hoy, salvo que ya tuviera una fecha anterior.
         end_date = case
           when end_date is null or end_date > current_date then current_date
           else end_date
         end
   where id = p_rental_id;
  perform set_config('inkey.transicion', 'off', true);

  insert into public.audit_log (actor_id, action, entity_type, entity_id)
  values (v_uid, 'alquiler.terminado', 'rental', p_rental_id);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.rental_confirm_end(uuid) from public, anon;
grant execute on function public.rental_confirm_end(uuid) to authenticated;

/** Me equivoqué: quien lo propuso puede dar marcha atrás mientras nadie confirmó. */
create or replace function public.rental_cancel_end(p_rental_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rental public.rentals;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'sin_sesion');
  end if;

  select * into v_rental from public.rentals where id = p_rental_id for update;

  if not found or v_rental.end_requested_by is distinct from v_uid then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;
  if v_rental.status <> 'pending_end' then
    return jsonb_build_object('ok', false, 'error', 'no_esta_terminando');
  end if;

  perform set_config('inkey.transicion', 'on', true);
  update public.rentals
     set status = 'active', end_requested_by = null, end_requested_at = null
   where id = p_rental_id;
  perform set_config('inkey.transicion', 'off', true);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.rental_cancel_end(uuid) from public, anon;
grant execute on function public.rental_cancel_end(uuid) to authenticated;

-- ----------------------------------------------------------- reseñas

/*
 * ¿Esta reseña se puede mostrar?
 * Sí cuando las dos están escritas (published_at ya quedó completo) o cuando
 * pasaron 14 días del fin del contrato. La regla se evalúa acá y no en el
 * código para que valga igual en RLS, en el perfil público y en la app,
 * incluso antes de que exista el cron que materializa published_at.
 */
create or replace function public.resena_visible(p_review public.reviews)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_review.published_at is not null
      or exists (
        select 1
          from public.rentals r
         where r.id = p_review.rental_id
           and r.ended_at is not null
           and r.ended_at <= now() - interval '14 days'
      );
$$;

revoke all on function public.resena_visible(public.reviews) from public, anon;
grant execute on function public.resena_visible(public.reviews) to authenticated;

-- La política de lectura usa la regla, no solo la columna.
drop policy if exists "reseña: la propia siempre; la ajena, una vez publicada" on public.reviews;

create policy "reseña: la propia siempre; la ajena, cuando se puede mostrar"
  on public.reviews for select
  to authenticated
  using (
    author_id = (select auth.uid())
    or (subject_id = (select auth.uid()) and public.resena_visible(reviews))
  );

/*
 * Dejar la reseña. Se guarda enseguida pero no se muestra hasta que la otra
 * también esté escrita: así nadie responde a lo que dijo el otro.
 */
create or replace function public.review_submit(
  p_rental_id uuid,
  p_text text default null,
  p_tags text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_rental public.rentals;
  v_direction text;
  v_subject uuid;
  v_texto text := nullif(btrim(coalesce(p_text, '')), '');
  v_tags text[] := coalesce(p_tags, '{}');
  v_invalidas int;
  v_id uuid;
  v_ambas boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'sin_sesion');
  end if;

  select * into v_rental from public.rentals where id = p_rental_id for update;

  if not found or (v_rental.tenant_id is distinct from v_uid and v_rental.owner_id is distinct from v_uid) then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;
  if v_rental.status <> 'ended' then
    return jsonb_build_object('ok', false, 'error', 'todavia_no_termino');
  end if;

  if v_rental.tenant_id = v_uid then
    v_direction := 'tenant_to_owner';
    v_subject := v_rental.owner_id;
  else
    v_direction := 'owner_to_tenant';
    v_subject := v_rental.tenant_id;
  end if;

  if v_subject is null then
    return jsonb_build_object('ok', false, 'error', 'sin_contraparte');
  end if;
  if v_texto is null and coalesce(array_length(v_tags, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'vacia');
  end if;
  if char_length(coalesce(v_texto, '')) > 500 then
    return jsonb_build_object('ok', false, 'error', 'texto_largo');
  end if;

  -- Las etiquetas tienen que existir y corresponder a esta dirección.
  select count(*) into v_invalidas
    from unnest(v_tags) as etiqueta
   where not exists (
     select 1 from public.review_tag_defs d
      where d.code = etiqueta and d.direction = v_direction and d.active
   );
  if v_invalidas > 0 then
    return jsonb_build_object('ok', false, 'error', 'etiqueta_invalida');
  end if;

  if exists (select 1 from public.reviews where rental_id = p_rental_id and author_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'ya_la_dejaste');
  end if;

  insert into public.reviews (rental_id, author_id, subject_id, direction, text, tags)
  values (p_rental_id, v_uid, v_subject, v_direction, v_texto, v_tags)
  returning id into v_id;

  -- Si ya están las dos, se publican juntas en este mismo momento.
  select count(*) = 2 into v_ambas from public.reviews where rental_id = p_rental_id;

  if v_ambas then
    perform set_config('inkey.transicion', 'on', true);
    update public.reviews
       set published_at = now()
     where rental_id = p_rental_id and published_at is null;
    perform set_config('inkey.transicion', 'off', true);
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'resena.escrita', 'review', v_id,
          jsonb_build_object('rental_id', p_rental_id, 'publicada', v_ambas));

  return jsonb_build_object('ok', true, 'review_id', v_id, 'publicada', v_ambas);
end;
$$;

revoke all on function public.review_submit(uuid, text, text[]) from public, anon;
grant execute on function public.review_submit(uuid, text, text[]) to authenticated;

/*
 * Materializa la publicación de las reseñas que ya cumplieron los 14 días.
 * La regla vale igual sin esto (ver resena_visible), pero dejar published_at
 * escrito hace que las consultas sean simples y que la fecha quede registrada.
 * La llama el cron (Fase 6).
 */
create or replace function public.reviews_publish_due()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_publicadas integer;
begin
  perform set_config('inkey.transicion', 'on', true);

  with vencidas as (
    update public.reviews rev
       set published_at = now()
      from public.rentals r
     where r.id = rev.rental_id
       and rev.published_at is null
       and r.ended_at is not null
       and r.ended_at <= now() - interval '14 days'
    returning rev.id
  )
  select count(*) into v_publicadas from vencidas;

  perform set_config('inkey.transicion', 'off', true);
  return v_publicadas;
end;
$$;

revoke all on function public.reviews_publish_due() from public, anon, authenticated;
grant execute on function public.reviews_publish_due() to service_role;

-- ------------------------------- las reseñas en el perfil compartible

/*
 * Reemplaza public_profile() para sumar las reseñas publicadas.
 *
 * De cada reseña sale el texto, las etiquetas y la fecha. NO sale quién la
 * escribió: alcanza con saber que fue la otra parte de ese alquiler, y así no
 * exponemos a nadie de más.
 */
create or replace function public.public_profile(p_token_hash text, p_contar boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_link public.share_links;
  v_perfil public.profiles;
  v_metricas jsonb;
  v_resenas jsonb;
  v_direccion text;
begin
  select * into v_link from public.share_links where token_hash = p_token_hash;

  if not found then
    return jsonb_build_object('estado', 'inexistente');
  end if;
  if v_link.revoked_at is not null then
    return jsonb_build_object('estado', 'revocado');
  end if;
  if v_link.expires_at is not null and v_link.expires_at <= now() then
    return jsonb_build_object('estado', 'vencido');
  end if;

  select * into v_perfil from public.profiles where id = v_link.user_id;

  if v_perfil.deleted_at is not null then
    return jsonb_build_object('estado', 'revocado');
  end if;

  v_metricas := public.profile_metrics(v_link.user_id, v_link.subject_role);

  -- Los montos salen del objeto salvo que la persona los haya activado.
  if not v_link.show_amounts then
    v_metricas := v_metricas - 'montos';
  end if;

  -- En el perfil de inquilino se muestran las reseñas que le dejaron sus
  -- dueños, y al revés.
  v_direccion := case when v_link.subject_role = 'tenant' then 'owner_to_tenant' else 'tenant_to_owner' end;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'texto', rev.text,
        'etiquetas', coalesce(
          (select jsonb_agg(d.label order by d.orden)
             from public.review_tag_defs d
            where d.code = any (rev.tags)),
          '[]'::jsonb
        ),
        'fecha', coalesce(rev.published_at, rev.created_at),
        'de', case when rev.direction = 'owner_to_tenant' then 'Su dueño' else 'Su inquilino' end
      )
      order by coalesce(rev.published_at, rev.created_at) desc
    ),
    '[]'::jsonb
  )
  into v_resenas
  from public.reviews rev
  where rev.subject_id = v_link.user_id
    and rev.direction = v_direccion
    and public.resena_visible(rev);

  if p_contar then
    perform set_config('inkey.transicion', 'on', true);
    update public.share_links
       set view_count = view_count + 1, last_viewed_at = now()
     where id = v_link.id;
    perform set_config('inkey.transicion', 'off', true);
  end if;

  return jsonb_build_object(
    'estado', 'valido',
    'rol', v_link.subject_role,
    'nombre', coalesce(v_perfil.first_name, ''),
    'inicial_apellido', left(coalesce(v_perfil.last_name, ''), 1),
    'muestra_montos', v_link.show_amounts,
    'metricas', v_metricas,
    'resenas', v_resenas
  );
end;
$$;

revoke all on function public.public_profile(text, boolean) from public;
grant execute on function public.public_profile(text, boolean) to anon, authenticated;
