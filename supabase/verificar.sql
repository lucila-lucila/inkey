/*
 * ¿Está todo aplicado?
 *
 * Pegá este archivo entero en el SQL Editor de Supabase y dale Run. Devuelve
 * una fila por cosa que tiene que existir, con "ok" o "FALTA". Si hay algún
 * FALTA, aplicá la migración que dice la última columna y volvé a correrlo.
 *
 * No modifica nada: solo mira.
 */

with esperado(clase, nombre, migracion) as (
  values
    -- Tablas -------------------------------------------------------------
    ('tabla', 'profiles',          '20260919120100_profiles'),
    ('tabla', 'waitlist_signups',  '20260919120200_waitlist'),
    ('tabla', 'rate_limit_events', '20260919120300_rate_limit'),
    ('tabla', 'audit_log',         '20260919120400_audit_log'),
    ('tabla', 'rentals',           '20260920120000_rentals'),
    ('tabla', 'invitations',       '20260920120100_invitations'),
    ('tabla', 'payments',          '20260921120000_payments'),
    ('tabla', 'share_links',       '20260922120000_share_links'),
    ('tabla', 'reviews',           '20260923120000_reviews'),
    ('tabla', 'review_tag_defs',   '20260923120000_reviews'),
    ('tabla', 'notifications',     '20260924120000_notificaciones'),
    ('tabla', 'action_tokens',     '20260924120000_notificaciones'),

    -- Funciones ----------------------------------------------------------
    ('función', 'handle_new_user',                 '20260919120100_profiles'),
    ('función', 'rate_limit_hit',                  '20260919120300_rate_limit'),
    ('función', 'comparte_alquiler_con',           '20260920120000_rentals'),
    ('función', 'invitation_preview',              '20260920120200_invitation_flow'),
    ('función', 'invitation_accept',               '20260920120200_invitation_flow'),
    ('función', 'invitation_reject',               '20260920120200_invitation_flow'),
    ('función', 'payment_report',                  '20260921120000_payments'),
    ('función', 'payment_confirm',                 '20260921120000_payments'),
    ('función', 'payment_not_received',            '20260921120000_payments'),
    ('función', 'profile_metrics',                 '20260922120000_share_links'),
    ('función', 'public_profile',                  '20260922120000_share_links'),
    ('función', 'rental_request_end',              '20260923120000_reviews'),
    ('función', 'rental_confirm_end',              '20260923120000_reviews'),
    ('función', 'review_submit',                   '20260923120000_reviews'),
    ('función', 'reviews_publish_due',             '20260923120000_reviews'),
    ('función', 'resena_visible',                  '20260923120000_reviews'),
    ('función', 'pagos_sin_respuesta',             '20260924120000_notificaciones'),
    ('función', 'notification_claim',              '20260924120000_notificaciones'),
    ('función', 'notification_settle',             '20260924120000_notificaciones'),
    ('función', 'payment_confirm_with_token',      '20260924120000_notificaciones'),
    ('función', 'payment_not_received_with_token', '20260924120000_notificaciones'),
    ('función', 'payment_token_preview',           '20260924120000_notificaciones')
),
revision as (
  select
    e.clase,
    e.nombre,
    e.migracion,
    case e.clase
      when 'tabla' then exists (
        select 1 from pg_tables where schemaname = 'public' and tablename = e.nombre
      )
      else exists (
        select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = e.nombre
      )
    end as existe,
    case
      when e.clase = 'tabla' then (
        select c.relrowsecurity from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = e.nombre
      )
    end as con_rls
  from esperado e
)
select
  case when existe and coalesce(con_rls, true) then 'ok' else 'FALTA' end as estado,
  clase,
  nombre,
  case
    when not existe then 'no existe'
    when con_rls is false then 'existe pero SIN row level security'
    else ''
  end as detalle,
  migracion
from revision
order by estado desc, clase, nombre;

-- El bucket privado de los documentos (contratos y comprobantes).
select
  case when exists (
    select 1 from storage.buckets where id = 'documentos' and public = false
  ) then 'ok' else 'FALTA' end as estado,
  'bucket' as clase,
  'documentos (privado)' as nombre,
  '20260920120300_storage_documentos' as migracion;

-- Resumen: cuántas tablas de public quedaron sin RLS. Tiene que dar 0.
select count(*) as tablas_sin_rls
  from pg_tables t
  join pg_class c on c.relname = t.tablename
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
 where t.schemaname = 'public' and c.relrowsecurity = false;
