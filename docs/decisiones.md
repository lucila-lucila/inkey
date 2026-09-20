# Decisiones

Lo que fuimos acordando, con el motivo. Si algo cambia, se edita acá y se
explica por qué.

## Producto

**La landing sigue siendo lista de espera.** El formulario del hero guarda mail
y rol en `waitlist_signups`. Cuando abramos, ese mismo formulario pasa a ser el
ingreso (`/ingresar` ya existe y funciona).

**El link del mail al dueño no da sesión.** Cuando el dueño recibe el aviso de
un pago reportado, el link lo lleva directo a confirmar *ese* pago y nada más:
no abre la cuenta. Un mail reenviado no tiene que darle acceso a un tercero al
historial completo. (Se implementa en la Fase 5 con la tabla `action_tokens`:
token de un solo uso, de vida corta y limitado a una acción sobre un pago.)

**Montos en USD sin conversión.** Se muestran tal cual se cargaron. No
inventamos cotizaciones.

**Textos legales como placeholder.** `[TÉRMINOS Y CONDICIONES]` y
`[POLÍTICA DE PRIVACIDAD]` hasta tener los textos reales.

## Borrado de cuenta (Ley 25.326)

El historial confirmado es de **las dos partes**. Por eso una baja no borra en
cascada: despersonaliza.

1. El perfil se marca con `deleted_at` y se borran nombre, apellido, teléfono y
   avatar. Todos los links compartibles se revocan.
2. Los alquileres y pagos sobreviven **para la contraparte**, que sigue viendo
   su propio historial. La persona dada de baja aparece como
   "Usuario dado de baja".
3. Las reseñas que esa persona **escribió** quedan publicadas, ya anónimas. Las
   que **recibió** dejan de mostrarse en cualquier lado.
4. Los comprobantes y contratos que subió se borran del Storage **a los 30
   días**: la contraparte puede necesitarlos como respaldo fiscal. Al programar
   ese borrado se le manda un mail avisándole que tiene 30 días para
   descargarlos si los necesita.
5. El recibo PDF ya emitido queda: también es documento de la contraparte.
6. El mail se libera. Esa persona puede volver a registrarse y empieza de cero.

Antes de la baja, "Descargar mis datos" entrega todo en JSON/CSV.
Se implementa en la Fase 7.

## Stack

**Rate limiting en Postgres, no en Redis.** Ventana deslizante en
`rate_limit_events` + la función `rate_limit_hit`. Para el volumen del MVP
alcanza y no suma otro proveedor. La interfaz está aislada en
`src/lib/ratelimit/`, así que mudarlo a Redis después es cambiar un archivo.
No guardamos la IP: guardamos `sha256(RATE_LIMIT_SALT || IP)`.

**Tests de RLS contra un Postgres real, sin Docker.** `pnpm test:rls` levanta un
cluster efímero con los binarios de Postgres, le aplica un bootstrap que imita
lo que trae un proyecto Supabase nuevo (roles `anon` / `authenticated` /
`service_role`, `auth.users`, `auth.uid()` y los privilegios por defecto) y
después todas las migraciones del repo. Cada test pregunta algo concreto:
¿puede esta persona leer o tocar algo ajeno?

**Tailwind v4 con `@theme`.** Los tokens viven una sola vez, en
`src/styles/tokens.css`, y Tailwind los expone como utilidades (`bg-surface`,
`text-ink`, …). El modo oscuro sale de los mismos tokens.

**Las fuentes se cargan como en la landing aprobada, no con `next/font`.**
Con `next/font` Google sirve otro corte óptico de Fraunces: los títulos quedan
~2% más anchos y rompen en distinto lugar que el diseño aprobado. Usamos el
mismo `<link>` de Google Fonts que `reference/landing.html` y el render es
idéntico (verificado midiendo el ancho de los títulos en las dos páginas).
Si más adelante queremos sacar el pedido a terceros, el camino es bajar esos
mismos `.woff2` y servirlos nosotros, no cambiar de corte.

## Modelo de datos: ajustes sobre la propuesta inicial

- `rentals.tenant_id` también es nullable, no solo `owner_id`: cuando el alta la
  hace el dueño, el inquilino todavía no existe.
- `payments` guarda `due_date` propio (foto del vencimiento al crear el
  período). Si no, editar `due_day` cambiaría retroactivamente la puntualidad de
  pagos ya confirmados.
- `payments.on_time` es columna generada: las métricas públicas no dependen de
  que el código se acuerde de la regla.
- `share_links` guarda el hash del token, igual que las invitaciones, y suma
  `subject_role` (una misma cuenta comparte perfil de inquilina o de dueña).
- `reviews` usa una tabla de catálogo de etiquetas: las del inquilino y las del
  dueño son distintas y queremos agregar o sacar sin migrar.
- `audit_log` no guarda IP ni user agent: dato personal que no necesitamos.
