/*
 * La gente que se anotó antes de abrir.
 *
 * La lista de espera dejó de existir en la landing cuando lanzamos, pero los
 * datos quedan: esas personas pidieron que les avisáramos y hay que avisarles.
 * La tabla sigue cerrada para `anon` y `authenticated`, así que esto se corre
 * desde el SQL Editor de Supabase, que usa el rol de administración.
 *
 * Correlo, bajá el CSV con el botón "Download CSV" y mandá el aviso desde
 * Resend. No hace falta cargar estos mails en ningún otro lado.
 */

-- ------------------------------------------------- a quién avisarle todavía

/*
 * Excluye a quien ya se creó la cuenta por su cuenta: mandarle "ya abrimos" a
 * alguien que está usando Inkey hace una semana es una forma rara de saludar.
 */
select
  w.email,
  w.role as se_anoto_como,
  w.created_at as se_anoto_el
from public.waitlist_signups w
where not exists (
  select 1 from auth.users u where lower(u.email) = lower(w.email::text)
)
order by w.created_at;

-- ------------------------------------------------------------- un resumen

select
  count(*) as anotados,
  count(*) filter (where role = 'inquilino') as inquilinos,
  count(*) filter (where role = 'propietario') as propietarios,
  count(*) filter (
    where exists (select 1 from auth.users u where lower(u.email) = lower(email::text))
  ) as ya_tienen_cuenta,
  min(created_at)::date as primero,
  max(created_at)::date as ultimo
from public.waitlist_signups;
