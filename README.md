# Inkey

Tu historial de alquiler, confirmado entre inquilino y dueño.

Cada mes el inquilino marca que pagó y el dueño confirma "recibido". Ese
historial es del inquilino: lo comparte con un link cuando busca su próximo
alquiler. Sin datos crediticios, sin listas de morosos, nada público por
defecto.

La especificación completa está en [`CLAUDE.md`](CLAUDE.md), la identidad
visual vigente en [`docs/identidad.md`](docs/identidad.md), las decisiones
tomadas (con su motivo) en [`docs/decisiones.md`](docs/decisiones.md) y la
revisión de seguridad en [`docs/auditoria-seguridad.md`](docs/auditoria-seguridad.md).

## Estado

| Fase | Qué incluye | Estado |
| --- | --- | --- |
| 1 | Base: tokens, componentes, auth, onboarding, perfiles, RLS, landing | ✅ |
| 2 | Alquileres e invitaciones | ✅ |
| 3 | Pagos, comprobantes y recibo PDF | ✅ |
| 4 | Perfil compartible | ✅ |
| 5 | Fin de contrato y reseñas | ✅ |
| 6 | Notificaciones y recordatorios | ✅ |
| 7 | Cierre: cuenta y privacidad, seed, flujos completos, auditoría | ✅ |

## Correrlo en tu máquina

```bash
pnpm install
cp .env.example .env.local   # completá los valores
pnpm dev                     # http://localhost:3000
```

La landing y `/ingresar` levantan aunque todavía no haya Supabase configurado.
Para entrar de verdad (magic link, Google, onboarding) hace falta un proyecto de
Supabase.

### Conectar Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. Copiá la URL y las claves a `.env.local` (mirá `.env.example`: la anon key es
   pública, la service role **es secreta** y solo vive en el servidor).
3. Aplicá las migraciones, en orden, desde `supabase/migrations/`. Con la CLI:

   ```bash
   supabase link --project-ref TU-REF
   supabase db push
   ```

   O pegando cada archivo en el SQL Editor, de más viejo a más nuevo.
4. **Verificá que estén todas**: pegá `supabase/verificar.sql` en el SQL Editor
   y dale Run. Devuelve una fila por tabla, función y bucket que tiene que
   existir, con `ok` o `FALTA`, y al final cuántas tablas quedaron sin RLS (eso
   tiene que dar 0). No modifica nada.
5. En **Authentication → Providers** dejá habilitado Email (magic link) y
   configurá Google.
6. En **Authentication → URL Configuration** poné el Site URL del dominio y
   agregá a las redirect URLs `http://localhost:3000/auth/callback`, el del
   dominio con `www` y el de sin `www`.
7. En **Authentication → Emails → Templates**, cargá las plantillas de
   `supabase/templates/` (ver más abajo).
8. Opcional, **solo en un proyecto de prueba**: pegá `supabase/seed.sql` en el
   SQL Editor para tener datos de ejemplo (tres personas, tres alquileres con
   sus estados, 18 pagos confirmados y dos reseñas publicadas). Es idempotente
   y no le manda mail a nadie. **Nunca contra producción**: crea usuarios y
   escribe saltando RLS.

### Conectar Resend (mails)

Los mails son una tarea secundaria: si Resend no está configurado, la app
funciona igual y cada aviso que no sale queda registrado en la consola y en la
tabla `notifications`. Nada se rompe por no tener mail.

1. Creá una cuenta en [resend.com](https://resend.com) y una API key.
2. Cargá `RESEND_API_KEY` en `.env.local` y en Vercel.
3. Cargá `EMAIL_FROM` con el remitente. **Sin dominio propio**, usá el de
   prueba de Resend:

   ```
   EMAIL_FROM="Inkey <onboarding@resend.dev>"
   ```

   Ese remitente solo puede escribirle a la casilla con la que te registraste
   en Resend: sirve para probar el flujo, no para mandarle a un dueño real.
4. Cargá `EMAIL_REPLY_TO` con la casilla que leés de verdad: los avisos salen
   de una dirección que nadie mira, pero las respuestas tienen que llegar a
   alguien.
5. Cargá también `CRON_SECRET` (cualquier cadena larga y aleatoria): sin ella,
   `/api/cron/recordatorios` devuelve 503 y no corre.

#### Verificar el dominio en Resend

Resend necesita tres registros DNS para poder firmar los mails con tu dominio.
**Conviene verificar un subdominio de envío** (`mail.inkeyapp.com`) y no el
dominio pelado: así el SPF y el MX del correo de Google Workspace, que viven en
el dominio raíz, no se tocan. Solo hay un SPF permitido por nombre, y pisarlo
rompe el correo de la gente.

1. En Resend, **Domains → Add Domain** → `mail.inkeyapp.com`, región
   `us-east-1` (o la que prefieras, pero acordate de cuál elegiste: el MX
   cambia).
2. Resend muestra tres registros. Cargalos en el DNS del dominio **tal cual los
   muestra**, sin repetir el dominio en el nombre si el panel ya lo agrega
   solo:
   - `TXT` en `resend._domainkey.mail` → la clave DKIM que te da Resend.
   - `TXT` en `mail` → `v=spf1 include:amazonses.com ~all`.
   - `MX` en `send.mail` (prioridad 10) → `feedback-smtp.us-east-1.amazonses.com`.
3. Volvé a Resend y tocá **Verify**. Tarda entre minutos y unas horas.
4. Opcional pero recomendado, `TXT` en `_dmarc` →
   `v=DMARC1; p=none; rua=mailto:contacto@tu-dominio`. Si ya existe un `_dmarc`,
   **no agregues otro**: editá el que está.
5. Cambiá en Vercel `EMAIL_FROM` por una dirección de ese subdominio y
   `EMAIL_REPLY_TO` por la casilla que sí leés, y volvé a deployar:

   ```
   EMAIL_FROM="Inkey <hola@mail.tu-dominio>"
   EMAIL_REPLY_TO=contacto@tu-dominio
   ```

   No hace falta tocar código: las dos salen enteras de esas variables.
6. Revisá que `NEXT_PUBLIC_SITE_URL` sea el dominio definitivo: de ahí salen
   los links de los mails, las URLs canónicas y el `robots.txt`.
7. Probá de punta a punta: reportá un pago y confirmalo desde el mail. Si algo
   no sale, `/api/salud` dice qué falta.

### Los mails de ingreso (Supabase)

Los mails de la app (pagos, invitaciones, reseñas) los manda Resend desde
nuestro código. Los de **ingreso** los manda Supabase, con su propio servidor y
sus propias plantillas.

1. Para que salgan del dominio propio y no del de Supabase (que tiene un tope
   bajo de envíos): **Project Settings → Authentication → SMTP Settings**,
   activá "Enable Custom SMTP" y cargá:

   | Campo | Valor |
   | --- | --- |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | tu API key de Resend |
   | Sender email | la misma dirección de `EMAIL_FROM` |
   | Sender name | `Inkey` |

2. **Authentication → Emails → Templates**: copiá cada archivo de
   `supabase/templates/` en su pestaña (el asunto está en la primera línea de
   cada archivo). Están en castellano y con la identidad de Inkey.

3. Las plantillas incluyen `{{ .Token }}`, el código de 6 dígitos. **Es
   obligatorio**: sin eso Supabase no manda el código y la pantalla de
   `/ingresar` se queda sin su alternativa al link. Existe porque algunos
   servicios de correo abren los links solos para revisarlos y los gastan
   antes de que la persona los toque.

### Recordatorios (cron)

`vercel.json` programa `/api/cron/recordatorios` todos los días a las 13:00 UTC
(10:00 en Argentina). Cada corrida hace dos cosas:

- le recuerda por mail al dueño los pagos reportados hace 3 días o más que
  todavía no respondió (una sola vez por reporte: lo garantiza `dedupe_key`);
- publica las reseñas que ya cumplieron los 14 días.

Para probarlo a mano:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/recordatorios
```

**Un solo cron, por el plan Hobby.** Hobby permite hasta dos tareas y como
mucho una por día cada una; una expresión más frecuente no se degrada, hace
**fallar el deploy entero**. Por eso la tarea diaria hace las dos cosas.
Vercel además dispara en algún momento de esa hora, no a las 13:00 en punto:
como las dos tareas miden en días, da igual.

Si alguna vez hiciera falta más seguido sin pasar al plan pago, el endpoint ya
está preparado: cualquier programador externo que sepa mandar un header puede
llamarlo (por ejemplo un workflow de GitHub Actions con `schedule`, guardando
`CRON_SECRET` como secret del repo). No hay que tocar código: es el mismo
endpoint, y como cada aviso se reserva con su clave, llamarlo de más no manda
nada repetido.

El test `tests/unit/despliegue.test.ts` verifica que `vercel.json` siga
entrando en Hobby y no tenga propiedades que Vercel rechace.

## Tests

```bash
pnpm test        # Vitest: validaciones, lógica, plantillas, identidad
pnpm test:rls    # Postgres real: seguridad y flujos completos
pnpm test:e2e    # Playwright: las pantallas, en celular y escritorio
pnpm check       # typecheck + lint + tests unitarios
```

`pnpm test:rls` levanta un cluster de Postgres efímero (necesita los binarios de
`postgresql-16`; no usa Docker), aplica las migraciones y corre dos familias de
casos:

- los de **RLS**, que preguntan si alguien puede leer o tocar algo ajeno. Si uno
  se pone en rojo, hay un agujero de seguridad: no lo dejes pasar.
- los de **FLUJO**, que recorren el camino completo de una persona usando la app
  (registrar el alquiler, invitar, aceptar, pagar mes a mes, compartir el
  historial, terminar el contrato, reseñar y darse de baja) con las mismas
  funciones que llama el código.

Lo que **no** cubren los tests automáticos: el ingreso con Supabase de verdad
(magic link, Google, el código del mail) necesita un proyecto real, así que esa
parte se prueba a mano. El resto del recorrido sí está cubierto.

## Cómo está organizado

```
src/
├── app/
│   ├── (marketing)/     landing
│   ├── (auth)/          /ingresar y /onboarding
│   ├── (app)/           pantallas con sesión (/panel, /alquileres, …)
│   ├── invitacion/      la pantalla que ve quien recibe el link
│   ├── p/[token]/       el perfil compartible (público, con PDF y preview)
│   ├── pagos/confirmar/ confirmar un pago desde el mail, sin sesión
│   ├── api/cron/        los recordatorios diarios
│   └── auth/callback/   vuelta del magic link y de Google
├── components/ui/       componentes base (Button, Card, Field, Pie, …)
├── components/legal/    cómo se ve un texto legal
├── components/landing/  secciones de la landing
├── lib/
│   ├── supabase/        clientes server / browser / admin y sesión
│   ├── validation/      esquemas Zod (mismos en cliente y servidor)
│   ├── domain/          reglas puras: montos, fechas, vencimientos
│   ├── email/           plantillas y envío (Resend), siempre opcional
│   ├── ratelimit/       ventana deslizante en Postgres
│   ├── tokens.ts        32 bytes aleatorios; de la base, solo el hash
│   └── storage.ts       documentos privados y URLs firmadas
└── styles/tokens.css    los tokens de diseño, una sola vez
docs/legales/            términos y privacidad (de acá salen las páginas)
supabase/migrations/     el esquema, versionado
supabase/seed.sql        datos de ejemplo (solo para desarrollo)
supabase/verificar.sql   ¿están todas las migraciones aplicadas?
supabase/templates/      los mails de ingreso que manda Supabase
tests/                   unit · rls · e2e
reference/landing.html   la landing de la Fase 1 (registro; la identidad
                         vigente es docs/identidad.md)
```

## Deploy

Va a Vercel. Las migraciones se aplican contra el proyecto de Supabase de
producción antes de publicar.

Las variables que tienen que estar cargadas en Vercel (Production y Preview):

| Variable | Sin ella | Secreta |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | la app no levanta | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la app no levanta | no |
| `SUPABASE_SERVICE_ROLE_KEY` | sin lista de espera, sin rate limiting, sin mails | **sí** |
| `RATE_LIMIT_SALT` | sin rate limiting | **sí** |
| `SHARE_LINK_SECRET` | no se pueden crear links de perfil | **sí** |
| `NEXT_PUBLIC_SITE_URL` | los links de los mails apuntan a localhost | no |
| `RESEND_API_KEY` | no sale ningún mail de la app | **sí** |
| `EMAIL_FROM` | los mails salen del remitente de prueba | no |
| `EMAIL_REPLY_TO` | las respuestas no llegan a nadie | no |
| `CRON_SECRET` | el cron no corre (503) | **sí** |

Las `NEXT_PUBLIC_*` se hornean en el build: si cambiás una, hay que volver a
deployar para que tome efecto. El dominio del proyecto también va a las
redirect URLs de Supabase, con `www` y sin `www`.

## Cuando algo no anda

**Primero: `/api/salud`.** Abrí `https://tu-dominio/api/salud`. Dice qué
variables de entorno faltan, si PostgREST ve las tablas (si acabás de aplicar
migraciones, el caché del esquema puede estar viejo), si las funciones públicas
responden y si el bucket de documentos existe y sigue siendo privado. Nunca
muestra el valor de ninguna variable.

Cómo leer los renglones:

- `tabla:*` → se preguntan con el service role, que es el único que ve todas
  las tablas. Un error acá casi siempre es una migración sin aplicar o el caché
  del esquema viejo: probá `notify pgrst, 'reload schema';` en el SQL Editor.
- `cerrado:*` → lo contrario: se preguntan **sin sesión**, y `ok` significa que
  una visita no puede leer esa tabla. Si alguno dijera `¡ABIERTA!`, hay un
  problema de seguridad de verdad.
- `rpc:*` → las funciones que sostienen `/invitacion`, `/p` y el link de
  confirmar un pago, preguntadas como las pregunta una visita.
- `sitio` → informativo: qué dominio está configurado y por cuál entraste.

**Los errores en pantalla traen un código.** Si algo se rompe de forma
inesperada, la pantalla muestra un mensaje con un código corto (por ejemplo
`a3f9c1`). Ese mismo código está en los logs del servidor como `[inkey:a3f9c1]`.

**Ver los logs del servidor en Vercel.** Los `console.error` de las Server
Actions salen por ahí, no por la consola del navegador:

- En el panel: proyecto → pestaña **Logs** (o **Observability → Logs**). Filtrá
  por `Runtime`, elegí la función y buscá el código `inkey:`. Para verlo en vivo
  mientras reproducís el error, dejá la vista abierta y apretá el botón de la
  app.
- Desde la terminal, en vivo:
  ```bash
  npx vercel login
  npx vercel link          # una sola vez, dentro del repo
  npx vercel logs <url-del-deploy> --follow
  ```
- Un deploy puntual: en **Deployments** → el deploy → **Runtime Logs**.

Los logs de runtime se guardan por poco tiempo, así que conviene mirarlos
mientras el problema está pasando.

## Pendiente antes de abrir al público

**CSP con nonce.** Hoy `script-src` incluye `'unsafe-inline'`, porque Next
inyecta su script de arranque sin nonce. Hay que generar un nonce por request
en `src/proxy.ts` y pasarlo a la cabecera y a los scripts de Next, para que la
CSP frene de verdad un XSS en vez de solo impedir que entre código de otro
dominio. Está acordado hacerlo antes de la apertura, no antes.

**Los textos legales, terminados de completar.** Están en `docs/legales/` y se
publican en `/terminos` y `/privacidad`, pero antes de abrir faltan tres cosas
que no son de programación:

1. **Identificar al responsable de los datos.** Hoy los textos dicen "Inkey, un
   servicio desarrollado en la República Argentina". La Ley 25.326 pide una
   persona humana o jurídica identificable, con domicilio: hay que poner el
   nombre o la razón social y la dirección.
2. **Inscribir la base en el Registro Nacional de Bases de Datos** de la
   Agencia de Acceso a la Información Pública. Es obligatorio para quien trata
   datos personales y es gratuito.
3. **Que un abogado revise los dos textos.** Están escritos para que se
   entiendan y para describir lo que la app hace de verdad, pero nadie de este
   lado es abogado.

El resto de lo que quedó abierto en
[`docs/auditoria-seguridad.md`](docs/auditoria-seguridad.md) son decisiones
conscientes, con su motivo escrito.

## Reglas que no se negocian

- El historial es del inquilino: nada es público por defecto.
- Solo se muestra lo positivo confirmado. No hay marcas negativas públicas.
- Sin datos crediticios: no consultamos bancos ni Veraz.
- RLS en todas las tablas y validación en el servidor, siempre.
