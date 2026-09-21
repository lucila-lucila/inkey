# Auditoría de seguridad

Revisión completa del repo al cerrar la Fase 7 (21 de septiembre de 2026).

Se revisó: el esquema y las políticas de RLS de las 14 tablas, las 40 funciones
de base, los permisos de cada rol, el Storage, los tokens, las Server Actions,
el proxy de sesión, los mails, el cron, las cabeceras HTTP y las variables de
entorno.

Lo que está arreglado se marca **✅ arreglado en esta fase**. Lo que queda
abierto lleva su gravedad y qué haría falta para cerrarlo.

---

## Arreglado en esta fase

### 🔴 Alta · Borrar un usuario destruía el historial de la otra parte

`rentals.created_by` tenía `on delete cascade`: borrar desde el panel de
Supabase a quien había cargado el alquiler borraba el alquiler entero, con sus
pagos, y la contraparte perdía un historial que también era suyo.

Además, `payments.reported_by`, `reviews.author_id` y `reviews.subject_id`
declaraban `on delete set null` sobre columnas `not null`: una contradicción
que hacía fallar cualquier borrado de usuario con un error de restricción.

**✅ arreglado** en `20260925120000_cuenta.sql`: las tres columnas admiten null
y `created_by` pasó a `set null`. La baja normal (`account_delete`) no borra
nada: despersonaliza.

### 🟠 Media · Inyección de HTML en los mails

Los nombres y los barrios los escribe la gente y se interpolaban sin escapar en
el HTML de los mails. Un cliente de correo no corre JavaScript, pero sí dibuja
etiquetas: alguien podía llamarse `<a href="http://phishing.test">Banco</a>` y
meter su link dentro de un mail de Inkey, con nuestro dominio como respaldo.

**✅ arreglado**: todo valor de origen humano pasa por `esc()` antes de entrar
al HTML, y por `limpio()` antes de entrar al asunto (donde un salto de línea
partía el encabezado). Hay tests con nombres hostiles.

### 🟠 Media · Sin cabeceras de seguridad

No había CSP, ni `X-Frame-Options`, ni `Referrer-Policy`, ni `nosniff`. Sin
`Referrer-Policy` explícita, un navegador viejo podía mandar la URL completa
—con el token de invitación o de perfil adentro— al pedir las tipografías a
Google.

**✅ arreglado** en `next.config.ts`: CSP, `frame-ancestors 'none'`,
`nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` y HSTS, con tests que las verifican.

### 🟡 Baja · `/api/salud` contaba la instalación entera a cualquiera

Devolvía sin autenticación los nombres de las tablas, los códigos de error de
Postgres y qué variables de entorno faltaban. No filtraba credenciales, pero
era reconocimiento servido en bandeja.

**✅ arreglado**: el detalle lo ve quien tiene sesión o quien manda
`Authorization: Bearer $CRON_SECRET`. Para el resto queda solo `ok`.

### 🟡 Baja · Faltaban límites de frecuencia en tres acciones

Había rate limiting en el ingreso, la lista de espera, las invitaciones y el
reporte de pagos, pero no en confirmar un pago, escribir una reseña ni exportar
los datos —la más pesada de todas, porque arma el historial completo en cada
llamada—.

**✅ arreglado**: se sumaron `confirmacion_pago` (30/hora), `resena` (10/hora) y
`export_datos` (5/hora), y el límite de confirmación cubre también las dos
acciones del link del mail, que son las únicas de pagos que se pueden tocar sin
sesión. El export devuelve 429 con `Retry-After`.

Queda una excepción deliberada: **darse de baja no tiene límite**. Es un
derecho, y un limitador no puede dejar a nadie encerrado en su cuenta.
`tests/unit/limites.test.ts` lee el código y exige que toda acción que escriba
pase por el limitador, o que la excepción tenga un motivo escrito.

### 🟡 Baja · Inyección de fórmulas en el CSV exportado

Una celda que empieza con `=`, `+`, `-` o `@` la ejecuta Excel al abrir el
archivo. El export incluye texto escrito por la otra parte (reseñas, notas).

**✅ arreglado** en `src/lib/exportar.ts`: esas celdas se prefijan con `'`.

---

## Abierto

### 🟠 Media · La CSP permite scripts en línea · **acordado para antes de abrir al público**

`script-src` incluye `'unsafe-inline'` porque Next inyecta el script de
arranque sin nonce. Si alguna vez entrara un XSS, la CSP no lo frenaría.

Mitiga hoy: no hay ningún `dangerouslySetInnerHTML` en el repo, React escapa
todo lo que renderiza, y `default-src 'self'` impide traer código de afuera.

Para cerrarlo: generar un nonce por request en `src/proxy.ts` y pasarlo a la
CSP y a los scripts de Next. **Decidido: se hace antes de abrir al público**,
no ahora.

### 🟠 Media · Quien tenga el link del mail puede responder ese pago

`/pagos/confirmar/[token]` confirma un pago sin sesión. Es deliberado (la
fricción cero para el dueño es un principio del producto) y está acotado: 32
bytes aleatorios, solo el hash en la base, 72 horas, un solo uso y una sola
acción sobre un solo pago. Pero quien reenvíe ese mail está delegando esa
confirmación.

Para cerrarlo, si alguna vez importa más que la fricción: pedir los últimos
dígitos del monto antes de confirmar.

### 🟡 Baja · El secreto de los links de perfil es una sola llave

Los tokens de `/p/[token]` se derivan con HMAC de `SHARE_LINK_SECRET`. Si esa
clave se filtra **y** alguien se lleva una copia de la base, puede reconstruir
todos los links vivos. Con la base sola no alcanza, que es lo que se buscaba.

Para cerrarlo: rotar la clave periódicamente (rompe los links compartidos) o
guardar por link una sal propia.

### 🟡 Baja · Los tokens viajan en la ruta de la URL

Invitaciones, perfiles compartidos y confirmación de pagos llevan el token en
el path, así que quedan en el historial del navegador y en los logs de acceso
de Vercel. Es el precio de que funcionen con un solo toque desde WhatsApp.

Mitiga hoy: vida corta, un solo uso donde corresponde, revocables, y
`Referrer-Policy` para que no salgan del sitio.

### 🟢 Informativo · El perfil público se puede reenviar

Un link de perfil no sabe a quién se lo dieron: quien lo reciba puede
reenviarlo. Es exactamente lo que el producto promete (el historial es del
inquilino y él decide con quién compartirlo) y por eso cada link es revocable,
cuenta las visitas y se puede tener más de uno, uno por destinatario.

---

## Lo que se revisó y está bien

- **RLS en las 14 tablas**, con `force row level security` y `revoke all` antes
  de cada `grant`. 89 pruebas contra un Postgres real lo verifican, incluidas
  las cuatro de flujo completo.
- **Ninguna escritura directa** a `payments`, `reviews` ni `action_tokens`: todo
  pasa por funciones `security definer` con `set search_path`.
- **Storage privado**: URLs firmadas de 60 segundos, solo para las dos partes
  del alquiler, y el tipo del archivo se detecta por sus primeros bytes, no por
  lo que declara el navegador.
- **Tokens**: 32 bytes aleatorios; de las invitaciones y de los tokens de acción
  se guarda solo el hash SHA-256.
- **Sin secretos en el cliente**: la única variable que llega al navegador es la
  anon key, que es pública por diseño y siempre pasa por RLS.
- **Redirecciones**: `rutaInternaSegura` solo deja volver a rutas internas.
- **Validación en el servidor** con Zod en todas las Server Actions.
- **El cron** exige `Authorization: Bearer $CRON_SECRET` y devuelve 503 si la
  variable no está, en vez de quedar abierto.
- **La bitácora** no guarda IP ni user agent, y el rate limiting guarda la IP
  hasheada con sal, nunca en claro.
- **`noindex`** en todo lo que no es la landing, reforzado con `robots.txt`.
- **Nada de datos crediticios ni listas de morosos**: un mes sin confirmar
  simplemente no suma, y `not_received` nunca sale del alquiler.
