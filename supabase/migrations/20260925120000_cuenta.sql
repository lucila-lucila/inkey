-- Cuenta y privacidad (Fase 7, Ley 25.326).
--
-- La baja de una cuenta NO borra en cascada: el historial confirmado es de las
-- dos partes, y borrar el de una sería borrarle a la otra algo que también es
-- suyo. Lo que se hace es despersonalizar (ver docs/decisiones.md).
--
-- Por eso la fila de `auth.users` sobrevive a la baja, anonimizada: es lo que
-- sostiene el historial de la contraparte. El mail se libera aparte, desde la
-- app, cambiándolo por uno inválido con la API de administración.

-- ------------------------------------------- arreglos de integridad previos

/*
 * Tres claves foráneas decían `on delete set null` sobre columnas `not null`.
 * Es una contradicción: si alguien borraba el usuario desde el panel de
 * Supabase, el borrado fallaba con "null value violates not-null constraint".
 * Y `rentals.created_by` iba en cascada: borrar a quien cargó el alquiler le
 * borraba el historial a la otra parte.
 *
 * Con esto, un borrado duro deja de destruir lo ajeno y deja de fallar. La
 * baja normal sigue siendo la de `account_delete`, que no borra nada.
 */
alter table public.payments alter column reported_by drop not null;
alter table public.reviews alter column author_id drop not null;
alter table public.reviews alter column subject_id drop not null;

alter table public.rentals alter column created_by drop not null;
alter table public.rentals drop constraint rentals_created_by_fkey;
alter table public.rentals
  add constraint rentals_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

-- ------------------------------------------------ reseñas de quien se da de baja

/*
 * Las reseñas que esa persona ESCRIBIÓ quedan: son parte del historial de la
 * otra, que no pidió nada. Las que RECIBIÓ dejan de mostrarse.
 */
alter table public.reviews add column if not exists hidden_at timestamptz;

comment on column public.reviews.hidden_at is
  'La persona reseñada se dio de baja: la reseña deja de mostrarse en todos lados.';

/*
 * El trigger que protege las reseñas sigue prohibiendo editarlas. Lo único que
 * puede cambiar después de escrita es `hidden_at` (la baja de quien la recibió)
 * y `published_at` (la publicación), y las dos pasan por funciones del sistema
 * que levantan la bandera `inkey.transicion`.
 */
create or replace function public.resena_visible(p_review public.reviews)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_review.hidden_at is null
     and (
       p_review.published_at is not null
       or exists (
         select 1
           from public.rentals r
          where r.id = p_review.rental_id
            and r.ended_at is not null
            and r.ended_at <= now() - interval '14 days'
       )
     );
$$;

-- ------------------------------------------------------ archivos a borrar

/*
 * Los comprobantes y el contrato que subió quien se da de baja se borran a los
 * 30 días, no en el momento: la contraparte puede necesitarlos como respaldo
 * fiscal, y se le avisa por mail que tiene ese plazo para descargarlos.
 */
create table public.file_deletions (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'documentos',
  path text not null,
  rental_id uuid references public.rentals (id) on delete cascade,
  -- Quién se dio de baja. Puede quedar en null si esa fila se borra del todo.
  requested_by uuid references auth.users (id) on delete set null,
  due_at timestamptz not null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bucket, path)
);

comment on table public.file_deletions is
  'Archivos de una cuenta dada de baja, con la fecha a partir de la cual se borran.';

create index file_deletions_pendientes on public.file_deletions (due_at) where done_at is null;

alter table public.file_deletions enable row level security;
alter table public.file_deletions force row level security;
revoke all on public.file_deletions from anon, authenticated;

-- --------------------------------------------------------- exportar mis datos

/*
 * "Descargar mis datos", en un solo viaje. Devuelve lo que es de esta persona:
 * su perfil, sus alquileres, sus pagos, sus links y sus reseñas.
 *
 * No incluye el teléfono ni el nombre de la contraparte: los datos personales
 * de la otra parte no son datos de quien exporta.
 */
create or replace function public.account_export()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with yo as (select (select auth.uid()) as id),
  mis_alquileres as (
    select r.*
      from public.rentals r, yo
     where r.tenant_id = yo.id or r.owner_id = yo.id
  )
  select jsonb_build_object(
    'exportado_el', now(),
    'perfil', (
      select to_jsonb(p) - 'avatar_url'
        from public.profiles p, yo
       where p.id = yo.id
    ),
    'alquileres', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'rol', case when a.tenant_id = (select id from yo) then 'inquilino' else 'propietario' end,
        'direccion', a.full_address,
        'barrio', a.neighborhood_label,
        'desde', a.start_date,
        'hasta', a.end_date,
        'monto_mensual', a.monthly_amount,
        'moneda', a.currency,
        'dia_de_vencimiento', a.due_day,
        'ajuste', a.adjustment_index,
        'ajusta_cada_meses', a.adjustment_every_months,
        'estado', a.status,
        'creado_el', a.created_at,
        'terminado_el', a.ended_at
      )) from mis_alquileres a
    ), '[]'::jsonb),
    'pagos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alquiler_id', p.rental_id,
        'periodo', p.period,
        'monto', p.amount,
        'moneda', p.currency,
        'pagado_el', p.paid_on,
        'vencia_el', p.due_date,
        'estado', p.status,
        'en_fecha', p.on_time,
        'reportado_el', p.reported_at,
        'confirmado_el', p.confirmed_at,
        'tiene_comprobante', p.receipt_path is not null
      ) order by p.period desc)
        from public.payments p
        join mis_alquileres a on a.id = p.rental_id
    ), '[]'::jsonb),
    'reseñas_que_escribí', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alquiler_id', v.rental_id,
        'direccion', v.direction,
        'texto', v.text,
        'etiquetas', v.tags,
        'escrita_el', v.created_at,
        'publicada_el', v.published_at
      )) from public.reviews v, yo where v.author_id = yo.id
    ), '[]'::jsonb),
    'reseñas_que_recibí', coalesce((
      select jsonb_agg(jsonb_build_object(
        'alquiler_id', v.rental_id,
        'direccion', v.direction,
        'texto', v.text,
        'etiquetas', v.tags,
        'publicada_el', v.published_at
      )) from public.reviews v, yo
       where v.subject_id = yo.id and public.resena_visible(v)
    ), '[]'::jsonb),
    'links_compartidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'etiqueta', l.label,
        'muestra_montos', l.show_amounts,
        'visitas', l.view_count,
        'creado_el', l.created_at,
        'revocado_el', l.revoked_at
      )) from public.share_links l, yo where l.user_id = yo.id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.account_export() from public, anon;
grant execute on function public.account_export() to authenticated;

-- ------------------------------------------------------------- darse de baja

/*
 * La baja, tal como está acordada en docs/decisiones.md:
 *
 *   1. el perfil se despersonaliza y queda marcado con `deleted_at`;
 *   2. todos los links compartibles se revocan;
 *   3. los alquileres y pagos sobreviven para la contraparte;
 *   4. las reseñas recibidas se ocultan; las escritas quedan, ya anónimas;
 *   5. los archivos que subió se programan para borrarse a los 30 días;
 *   6. el mail lo libera la app, cambiándolo por uno inválido.
 *
 * Devuelve a quién hay que avisarle del plazo de los 30 días, para que la app
 * mande los mails. Es idempotente: darse de baja dos veces no rompe nada.
 */
create or replace function public.account_delete()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_yo uuid := (select auth.uid());
  v_vence timestamptz := now() + interval '30 days';
  v_archivos integer := 0;
  v_avisos jsonb;
begin
  if v_yo is null then
    return jsonb_build_object('ok', false, 'error', 'sin_sesion');
  end if;

  -- 1. El perfil: se va todo lo que identifica a la persona.
  update public.profiles
     set first_name = null,
         last_name = null,
         phone = null,
         avatar_url = null,
         initial_intent = null,
         deleted_at = coalesce(deleted_at, now())
   where id = v_yo;

  -- 2. Ningún link compartido sigue vivo.
  update public.share_links
     set revoked_at = now()
   where user_id = v_yo and revoked_at is null;

  /*
   * 3. Las reseñas recibidas dejan de mostrarse. Una reseña no se edita nunca
   * (lo impide un trigger), así que este único cambio permitido se hace con la
   * misma bandera que usan las otras transiciones del sistema.
   */
  perform set_config('inkey.transicion', 'on', true);
  update public.reviews
     set hidden_at = now()
   where subject_id = v_yo and hidden_at is null;
  perform set_config('inkey.transicion', 'off', true);

  /*
   * 4. Los archivos que subió esta persona: los comprobantes que reportó y el
   * contrato de los alquileres que cargó. Se programan, no se borran.
   */
  insert into public.file_deletions (path, rental_id, requested_by, due_at)
  select p.receipt_path, p.rental_id, v_yo, v_vence
    from public.payments p
   where p.reported_by = v_yo and p.receipt_path is not null
  union
  select r.contract_path, r.id, v_yo, v_vence
    from public.rentals r
   where r.created_by = v_yo and r.contract_path is not null
  on conflict (bucket, path) do nothing;

  get diagnostics v_archivos = row_count;

  /*
   * 5. A quién avisarle: la otra parte de cada alquiler donde esta persona
   * subió algo que se va a borrar.
   */
  select coalesce(jsonb_agg(distinct jsonb_build_object(
           'user_id', contraparte,
           'rental_id', rental_id,
           'barrio', barrio
         )), '[]'::jsonb)
    into v_avisos
    from (
      select case when r.tenant_id = v_yo then r.owner_id else r.tenant_id end as contraparte,
             r.id as rental_id,
             r.neighborhood_label as barrio
        from public.rentals r
       where (r.tenant_id = v_yo or r.owner_id = v_yo)
         and exists (
           select 1 from public.file_deletions f
            where f.rental_id = r.id and f.requested_by = v_yo and f.done_at is null
         )
    ) t
   where contraparte is not null;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_yo, 'cuenta.baja', 'profile', v_yo,
          jsonb_build_object('archivos_programados', v_archivos, 'vencen', v_vence));

  return jsonb_build_object(
    'ok', true,
    'archivos_programados', v_archivos,
    'archivos_vencen', v_vence,
    'avisar_a', v_avisos
  );
end;
$$;

revoke all on function public.account_delete() from public, anon;
grant execute on function public.account_delete() to authenticated;

-- ------------------------------------------------- lo que consume el cron

/** Archivos cuyo plazo de 30 días ya venció. Los borra el cron diario. */
create or replace function public.archivos_por_borrar()
returns table (id uuid, bucket text, path text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f.id, f.bucket, f.path
    from public.file_deletions f
   where f.done_at is null and f.due_at <= now()
   limit 200;
$$;

revoke all on function public.archivos_por_borrar() from public, anon, authenticated;
grant execute on function public.archivos_por_borrar() to service_role;

/** Marca como borrado lo que el cron ya sacó del Storage. */
create or replace function public.archivo_borrado(p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.file_deletions set done_at = now() where id = p_id;
$$;

revoke all on function public.archivo_borrado(uuid) from public, anon, authenticated;
grant execute on function public.archivo_borrado(uuid) to service_role;
