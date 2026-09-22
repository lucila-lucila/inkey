/*
 * El idioma de cada persona.
 *
 * Vive en el perfil y no solo en una cookie por dos motivos: para que la
 * preferencia viaje con la persona cuando cambia de teléfono, y porque los
 * mails salen de un cron que no tiene un navegador del otro lado. Sin esto,
 * un aviso de pago le llegaría en castellano a alguien que usa la app en
 * inglés.
 *
 * Nulo significa "todavía no eligió": ahí decide el navegador.
 */

alter table public.profiles
  add column if not exists locale text
  check (locale in ('es', 'en'));

comment on column public.profiles.locale is
  'Idioma elegido (es | en). Nulo: todavía no eligió, decide el navegador.';

/*
 * Al darse de baja, el perfil se despersonaliza. El idioma se va con el
 * resto de las preferencias.
 *
 * Va como trigger y no adentro de `account_delete` para no tener que repetir
 * acá esa función entera: si mañana cambia, este pedacito no queda viejo.
 */
create or replace function public.profiles_baja_limpia_idioma()
returns trigger
language plpgsql
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    new.locale := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_baja_limpia_idioma on public.profiles;
create trigger profiles_baja_limpia_idioma
  before update on public.profiles
  for each row
  execute function public.profiles_baja_limpia_idioma();
