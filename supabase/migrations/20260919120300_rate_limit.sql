-- Rate limiting con ventana deslizante en Postgres. Vale para varias
-- instancias a la vez (Vercel) sin sumar otro proveedor.
-- Si el volumen lo pide, se reemplaza por Redis detrás de src/lib/ratelimit.

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket text not null,
  -- Hash de la IP con sal del servidor: nunca guardamos IPs en claro.
  identifier text not null,
  created_at timestamptz not null default now()
);

comment on column public.rate_limit_events.identifier is
  'sha256(sal || IP). No es reversible y no identifica a la persona por sí solo.';

create index rate_limit_events_lookup
  on public.rate_limit_events (bucket, identifier, created_at desc);

alter table public.rate_limit_events enable row level security;
alter table public.rate_limit_events force row level security;
revoke all on public.rate_limit_events from anon, authenticated;

/*
 * Consume un intento y responde si se permite.
 * Devuelve: { allowed, remaining, retry_after_seconds }
 */
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_identifier text,
  p_limit int,
  p_window_seconds int
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde timestamptz := now() - make_interval(secs => p_window_seconds);
  v_usados int;
  v_mas_viejo timestamptz;
begin
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'Límite y ventana tienen que ser positivos';
  end if;

  -- Limpieza oportunista: la tabla no crece sin control.
  delete from public.rate_limit_events
   where bucket = p_bucket
     and identifier = p_identifier
     and created_at < v_desde;

  select count(*), min(created_at)
    into v_usados, v_mas_viejo
    from public.rate_limit_events
   where bucket = p_bucket
     and identifier = p_identifier
     and created_at >= v_desde;

  if v_usados >= p_limit then
    return jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds',
        greatest(1, ceil(extract(epoch from (v_mas_viejo + make_interval(secs => p_window_seconds)) - now()))::int)
    );
  end if;

  insert into public.rate_limit_events (bucket, identifier)
  values (p_bucket, p_identifier);

  return jsonb_build_object(
    'allowed', true,
    'remaining', p_limit - v_usados - 1,
    'retry_after_seconds', 0
  );
end;
$$;

-- Solo el servidor. Si anon pudiera llamarla, podría gastarle la ventana a otro.
revoke all on function public.rate_limit_hit(text, text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, int, int) to service_role;
