# Inkey

Tu historial de alquiler, confirmado entre inquilino y dueño.

Cada mes el inquilino marca que pagó y el dueño confirma "recibido". Ese
historial es del inquilino: lo comparte con un link cuando busca su próximo
alquiler. Sin datos crediticios, sin listas de morosos, nada público por
defecto.

La especificación completa está en [`CLAUDE.md`](CLAUDE.md), la identidad
visual vigente en [`docs/identidad.md`](docs/identidad.md) y las decisiones
tomadas (con su motivo) en [`docs/decisiones.md`](docs/decisiones.md).

## Estado

| Fase | Qué incluye | Estado |
| --- | --- | --- |
| 1 | Base: tokens, componentes, auth, onboarding, perfiles, RLS, landing | ✅ |
| 2 | Alquileres e invitaciones | ✅ |
| 3 | Pagos, comprobantes y recibo PDF | ✅ |
| 4 | Perfil compartible | ✅ |
| 5 | Fin de contrato y reseñas | ⏳ |
| 6 | Notificaciones y recordatorios | ⏳ |
| 7 | Cierre: e2e, seed, seguridad, deploy | ⏳ |

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
4. En **Authentication → Providers** dejá habilitado Email (magic link) y
   configurá Google.
5. En **Authentication → URL Configuration** agregá
   `http://localhost:3000/auth/callback` y el de producción a las redirect URLs.

## Tests

```bash
pnpm test        # Vitest: validaciones y lógica
pnpm test:rls    # Row Level Security contra un Postgres real
pnpm test:e2e    # Playwright: landing e ingreso, en celular y escritorio
pnpm check       # typecheck + lint + tests unitarios
```

`pnpm test:rls` levanta un cluster de Postgres efímero (necesita los binarios de
`postgresql-16`; no usa Docker), aplica las migraciones y prueba que nadie pueda
leer ni modificar datos ajenos. Si alguno de esos tests se pone en rojo, hay un
agujero de seguridad: no lo dejes pasar.

## Cómo está organizado

```
src/
├── app/
│   ├── (marketing)/     landing
│   ├── (auth)/          /ingresar y /onboarding
│   ├── (app)/           pantallas con sesión (/panel, /alquileres, …)
│   ├── invitacion/      la pantalla que ve quien recibe el link
│   ├── p/[token]/       el perfil compartible (público, con PDF y preview)
│   └── auth/callback/   vuelta del magic link y de Google
├── components/ui/       componentes base (Button, Card, Field, …)
├── components/landing/  secciones de la landing
├── lib/
│   ├── supabase/        clientes server / browser / admin y sesión
│   ├── validation/      esquemas Zod (mismos en cliente y servidor)
│   ├── domain/          reglas puras: montos, fechas, vencimientos
│   ├── ratelimit/       ventana deslizante en Postgres
│   ├── tokens.ts        32 bytes aleatorios; de la base, solo el hash
│   └── storage.ts       documentos privados y URLs firmadas
└── styles/tokens.css    los tokens de diseño, una sola vez
supabase/migrations/     el esquema, versionado
tests/                   unit · rls · e2e
reference/landing.html   la landing de la Fase 1 (registro; la identidad
                         vigente es docs/identidad.md)
```

## Deploy

Va a Vercel. Cargá en el proyecto las mismas variables de `.env.example`
(`NEXT_PUBLIC_SITE_URL` con el dominio real) y agregá ese dominio a las redirect
URLs de Supabase. Las migraciones se aplican contra el proyecto de Supabase de
producción antes de publicar.

## Cuando algo no anda

**Primero: `/api/salud`.** Abrí `https://tu-dominio/api/salud`. Dice qué
variables de entorno faltan, si PostgREST ve las tablas (si acabás de aplicar
migraciones, el caché del esquema puede estar viejo) y si el bucket de
documentos existe. Nunca muestra el valor de ninguna variable.

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

## Reglas que no se negocian

- El historial es del inquilino: nada es público por defecto.
- Solo se muestra lo positivo confirmado. No hay marcas negativas públicas.
- Sin datos crediticios: no consultamos bancos ni Veraz.
- RLS en todas las tablas y validación en el servidor, siempre.
