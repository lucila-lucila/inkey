-- Inkey · Fase 1 · Cimientos
-- Extensiones, helpers compartidos y la convención de seguridad del proyecto:
--   * RLS habilitada en TODAS las tablas de public;
--   * ningún GRANT implícito: cada tabla dice qué puede hacer cada rol;
--   * las funciones security definer fijan search_path y se otorgan al rol
--     mínimo que las necesita.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- Mantiene updated_at sin que la app se tenga que acordar.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger BEFORE UPDATE: refresca updated_at en cada modificación.';
