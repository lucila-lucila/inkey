# Capturas del estado actual

Todas las pantallas de la app, en escritorio (1440px) y celular (390px), de
página completa. Están para mirar el diseño de conjunto: qué se repite, qué
desentona y qué falta.

Se generan solas con `pnpm capturas`, con los datos de `supabase/seed.sql`.
No hay que tener Supabase levantado: el guion arma un Postgres efímero con
las migraciones y el seed, le pone delante un Supabase de mentira
(`tests/capturas/supabase-falso.ts`) y corre la app de verdad contra eso.
Las consultas pasan por RLS, así que cada captura muestra lo que esa persona
puede ver y nada más.

Las personas son las del seed: Martina (inquilina), Jorge y Paula (dueños), y
Camila, que se registra en el momento para el onboarding y el panel vacío.

| # | Pantalla |
|---|---|
| 01–03 | `/ingresar`: vacío, esperando el código, y link vencido |
| 04 | `/onboarding` |
| 05 | `/panel` de alguien recién llegado |
| 06–08 | `/alquileres/nuevo`, los tres pasos |
| 09 | El link para invitar al dueño |
| 10 | `/panel` con alquileres |
| 11 | Un alquiler activo, con su historial |
| 11b | Un alquiler todavía pendiente |
| 12 | El panel del dueño |
| 13 | Reportar un pago (inquilina) |
| 14–15 | Confirmar un pago y "todavía no me llegó" (dueño) |
| 16 | `/perfil` con un link creado |
| 17b | La reseña, en un contrato terminado |
| 18 | `/cuenta` |
| 19 | `/invitacion/[token]`, sin sesión |
| 20 | `/pagos/confirmar/[token]`, el link del mail |
| 21 | `/p/[token]`, el perfil público |
