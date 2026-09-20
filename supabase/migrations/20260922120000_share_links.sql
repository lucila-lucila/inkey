-- Perfil compartible.
--
-- El historial es del inquilino: nada es público por defecto. Para que alguien
-- lo vea hace falta un link que esa persona creó y que puede revocar cuando
-- quiera.
--
-- Del token guardamos solo el hash, como con las invitaciones. La diferencia
-- es que un link de perfil se comparte muchas veces, así que tiene que poder
-- volver a mostrarse: el token se deriva del id del link con un HMAC y una
-- clave del servidor (ver src/lib/tokens.ts). Con la base sola no se puede
-- reconstruir ningún link vivo.

create table public.share_links (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- De qué lado muestra el historial: como inquilino o como dueño.
  subject_role text not null check (subject_role in ('tenant', 'owner')),
  token_hash text not null unique,
  -- Para distinguirlos en la lista: "Para la inmobiliaria de Palermo".
  label text check (char_length(btrim(label)) between 1 and 60),
  show_amounts boolean not null default false,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.share_links is
  'Links con los que alguien decide mostrar su historial. Revocables y contables.';
comment on column public.share_links.show_amounts is
  'Por defecto false: los montos no se muestran salvo que la persona los active.';

create index share_links_usuario on public.share_links (user_id, created_at desc);

alter table public.share_links enable row level security;
alter table public.share_links force row level security;

revoke all on public.share_links from anon, authenticated;
grant select, insert, update on public.share_links to authenticated;

create policy "link: cada quien ve los suyos"
  on public.share_links for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "link: cada quien crea los suyos"
  on public.share_links for insert
  to authenticated
  with check (user_id = (select auth.uid()) and view_count = 0 and revoked_at is null);

create policy "link: cada quien lo revoca o le cambia los montos"
  on public.share_links for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Ni el dueño del link puede falsear las visitas ni mudarlo a otra cuenta.
create or replace function public.share_links_guard_update()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('inkey.transicion', true), '') = 'on' then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.token_hash is distinct from old.token_hash
     or new.subject_role is distinct from old.subject_role
     or new.view_count is distinct from old.view_count
     or new.last_viewed_at is distinct from old.last_viewed_at then
    raise exception 'De un link solo se pueden cambiar la etiqueta, los montos y la revocación'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger share_links_guard_update_trigger
  before update on public.share_links
  for each row execute function public.share_links_guard_update();

-- ------------------------------------------------------------------ métricas

/*
 * Las métricas del historial, en un solo lugar: las usa el perfil propio y el
 * público, así que no hay dos definiciones de "meses confirmados" dando
 * vueltas.
 *
 * Reglas (CLAUDE.md):
 *   - solo cuenta lo confirmado por la otra parte;
 *   - "en fecha" es paid_on <= due_date sobre esos pagos confirmados;
 *   - "contratos cumplidos" son los terminados con al menos un pago confirmado;
 *   - lo no confirmado y lo `not_received` no aparecen ni restan.
 *
 * No se otorga a nadie: solo la llaman las funciones de abajo, que resuelven
 * de quién son las métricas que se están pidiendo.
 */
create or replace function public.profile_metrics(p_user_id uuid, p_role text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with alquileres as (
    select *
      from public.rentals
     where (p_role = 'tenant' and tenant_id = p_user_id)
        or (p_role = 'owner' and owner_id = p_user_id)
  ),
  confirmados as (
    select p.*
      from public.payments p
      join alquileres a on a.id = p.rental_id
     where p.status = 'confirmed'
  ),
  meses as (
    select to_char(m, 'YYYY-MM') as periodo,
           exists (select 1 from confirmados c where c.period = m::date) as confirmado
      from generate_series(
             date_trunc('month', current_date) - interval '11 months',
             date_trunc('month', current_date),
             interval '1 month'
           ) m
  )
  select jsonb_build_object(
    'meses_confirmados', (select count(*) from confirmados),
    'pagos_en_fecha', (select count(*) from confirmados where on_time),
    'porcentaje_en_fecha',
      case when (select count(*) from confirmados) = 0 then null
           else round(100.0 * (select count(*) from confirmados where on_time)
                            / (select count(*) from confirmados))
      end,
    'contratos_cumplidos', (
      select count(*) from alquileres a
       where a.status = 'ended'
         and exists (
           select 1 from public.payments p
            where p.rental_id = a.id and p.status = 'confirmed'
         )
    ),
    'contratos_totales', (select count(*) from alquileres where status in ('active', 'pending_end', 'ended')),
    'con_comprobante', (select count(*) from confirmados where receipt_path is not null),
    'con_contrato', (select count(*) from alquileres where contract_path is not null),
    'desde', (select min(start_date) from alquileres),
    'barrios', coalesce(
      (select jsonb_agg(distinct neighborhood_label) from alquileres),
      '[]'::jsonb
    ),
    'ultimos_12', (select jsonb_agg(jsonb_build_object('periodo', periodo, 'confirmado', confirmado)) from meses),
    'montos', jsonb_build_object(
      'total_confirmado', coalesce(
        (select jsonb_object_agg(currency, total)
           from (select currency, sum(amount) as total from confirmados group by currency) t),
        '{}'::jsonb
      ),
      'mensual_actual', (
        select jsonb_build_object('monto', a.monthly_amount, 'moneda', a.currency)
          from alquileres a
         where a.status = 'active'
         order by a.start_date desc
         limit 1
      )
    )
  );
$$;

revoke all on function public.profile_metrics(uuid, text) from public, anon, authenticated;

/** Mis propias métricas, para la pantalla /perfil. */
create or replace function public.my_profile_metrics(p_role text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when (select auth.uid()) is null then jsonb_build_object('error', 'sin_sesion')
    else public.profile_metrics((select auth.uid()), p_role)
  end;
$$;

revoke all on function public.my_profile_metrics(text) from public, anon;
grant execute on function public.my_profile_metrics(text) to authenticated;

-- ------------------------------------------------------------ perfil público

/*
 * Lo que ve quien abre /p/[token]. Devuelve exactamente lo que se puede
 * mostrar y nada más: nunca dirección completa, teléfono, mail, comprobantes
 * ni meses sin confirmar. Los montos, solo si la persona los activó.
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

  -- La imagen de preview y el PDF piden los mismos datos: esos no cuentan
  -- como una visita, para que el número diga lo que la gente espera.
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
    'metricas', v_metricas
  );
end;
$$;

revoke all on function public.public_profile(text, boolean) from public;
grant execute on function public.public_profile(text, boolean) to anon, authenticated;
