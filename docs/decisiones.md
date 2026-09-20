# Decisiones

Lo que fuimos acordando, con el motivo. Si algo cambia, se edita acá y se
explica por qué.

## Identidad visual (Vecindario)

La identidad provisoria de la Fase 1 quedó reemplazada por la definitiva, que
vive en [`docs/identidad.md`](identidad.md). **Ese documento manda sobre
`reference/landing.html`**, que queda como registro de lo aprobado en la Fase 1
y ya no es la fuente de verdad visual. (`CLAUDE.md` todavía apunta a la landing
de referencia para el sistema visual: cuando se actualice, tiene que apuntar a
`identidad.md`.)

Qué cambió: paleta nueva (crema cálido, terracota de marca, verde solo para
confirmado), Bricolage Grotesque + DM Sans en lugar de Fraunces + Instrument
Sans, tarjetas sin sombra ni borde separadas por color, botones redondos, logo
de dos llaves enganchadas y textos pasados por la tabla de tono de voz.

**Un desvío del documento, por accesibilidad.** La identidad propone `muted`
`#8B8179`, pero sobre los fondos claros da 3,56:1 y el mínimo que pide el mismo
documento es 4,5:1. Lo bajamos a `#786F68`, que es el ajuste más chico que
cumple sin cambiar el matiz. En modo oscuro el token quedó como está. Además,
dentro de las zonas hundidas las etiquetas usan `body` en lugar de `muted`,
porque ahí `muted` tampoco llegaba.

**Dos tokens que el documento no nombra pero el sistema necesita.**
`--on-sun` (tinta oscura fija, en los dos modos: el amarillo nunca lleva texto
claro) y el par `--invertido-bg` / `--invertido-ink` para el bloque oscuro de la
landing, que en modo oscuro pasa a superficie porque la página ya es oscura.

**Los botones llenos en modo oscuro** usan el tono claro del token con texto
oscuro, como indica el documento: en oscuro `primary` es `#E59B78` y el texto va
en `#1A1815`.

**El recibo en PDF** también cambió: paleta nueva, símbolo del logo dibujado con
las primitivas de react-pdf y etiquetas en mayúsculas. Sigue con tipografías
estándar del PDF (Helvetica, la más parecida a DM Sans de las que trae el
formato) por el mismo motivo de antes: incrustar las fuentes de la marca haría
más lento y más frágil cada render.

**Hay un test que cuida esto.** `tests/unit/identidad.test.ts` lee los tokens
reales del CSS y verifica el contraste de cada par en los dos modos: si alguien
toca un color y rompe AA, falla el build.

## Producto

**La landing sigue siendo lista de espera.** El formulario del hero guarda mail
y rol en `waitlist_signups`. Cuando abramos, ese mismo formulario pasa a ser el
ingreso (`/ingresar` ya existe y funciona).

**El link del mail al dueño no da sesión.** Cuando el dueño recibe el aviso de
un pago reportado, el link lo lleva directo a confirmar *ese* pago y nada más:
no abre la cuenta. Un mail reenviado no tiene que darle acceso a un tercero al
historial completo. Se implementa junto con los mails, en la Fase 6, con una
tabla `action_tokens`: token de un solo uso, de vida corta y limitado a una
acción sobre un pago. Hasta entonces el dueño confirma desde la app, que ya
funciona.

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

## Alquileres e invitaciones (Fase 2)

**El link de invitación se muestra una sola vez.** Guardamos el hash del token,
no el token, así que no se puede recuperar: si se pierde, se genera uno nuevo y
el anterior deja de funcionar en el acto. Vence a los 7 días.

**El resumen de la invitación muestra la dirección completa.** Es lo que
necesita el dueño para reconocer si la propiedad es suya; sin eso la pregunta
"¿confirmás este alquiler?" no se puede responder. El link es la credencial y
solo lo tiene quien lo recibió.

**Rechazar no pide sesión; aceptar sí.** Quien recibió el link por error tiene
que poder decir "no soy el dueño" sin crearse una cuenta. Es reversible: el
alquiler queda `rejected` y quien lo cargó puede volver a empezar con el
contacto correcto. Aceptar, en cambio, mete a la persona dentro del alquiler:
para eso se identifica.

**De un alquiler ya confirmado no se edita nada, salvo el contrato.** Un
trigger compara la fila entera: si cambió algo que no sea `contract_path`, lo
rechaza. Cambiar el monto o el día de vencimiento después de confirmado sería
cambiarle el historial a la otra parte. (Editar un alquiler activo es una
conversación entre las dos partes; si hace falta, se resuelve en una fase
posterior con acuerdo explícito de ambos.)

**Las partes y el estado no se cambian con un update suelto.** Solo los tocan
las funciones `invitation_accept` e `invitation_reject`, que validan todo antes.

**"Enviar por mail" abre el cliente de correo (`mailto:`).** Los mails
transaccionales llegan en la Fase 6 con Resend; hasta entonces esto funciona,
no es código muerto y se reemplaza sin tocar el resto.

## Pagos (Fase 3)

**La tabla `payments` no tiene políticas de INSERT ni UPDATE.** Todo pasa por
tres funciones `security definer`: `payment_report`, `payment_confirm` y
`payment_not_received`. Así hay un solo lugar donde se valida quién puede hacer
qué, y no hay forma de escribir un pago salteándolo.

**El vencimiento y la moneda los calcula el servidor, no el cliente.** Si el
inquilino pudiera mandar el `due_date`, cualquier pago sería "en fecha". La
función los saca del alquiler y guarda `due_date` como una foto: editar el
alquiler después no cambia la puntualidad de los meses ya registrados.

**`on_time` es una columna generada** (`paid_on <= due_date`). La puntualidad es
una propiedad del pago, no algo que cada consulta recalcule. La métrica pública
además exige `status = confirmed`: un mes sin confirmar no suma.

**Volver a reportar está permitido, y limpia la nota.** Si el dueño marca
"todavía no me llegó", el inquilino puede reportar de nuevo con el comprobante y
el mes vuelve a quedar pendiente de confirmación. Ese ida y vuelta no deja
ninguna marca: `not_received` es privado entre las partes.

**El recibo se genera al vuelo, no se guarda.** `/pagos/[id]/recibo` arma el PDF
en cada pedido. No hay archivo que sincronizar ni que proteger aparte: si RLS no
te da el pago, no hay recibo. La numeración (`receipt_serial`) se asigna al
confirmar y es correlativa dentro de cada alquiler.

**El recibo usa tipografías estándar del PDF, no Fraunces.** Incrustar la fuente
de la marca obligaría a cargar los archivos en cada render. El recibo mantiene
los colores y la estructura del sistema visual, pero prioriza salir rápido y
siempre igual.

## Perfil compartible (Fase 4)

**El token del link se deriva, no se guarda.** Un link de perfil se comparte
muchas veces, así que la persona tiene que poder volver a copiarlo: guardar solo
el hash (como en las invitaciones) lo haría imposible. La solución es derivarlo:
`token = HMAC(SHARE_LINK_SECRET, id_del_link)`, y de la base guardamos solo el
hash del resultado. Con una copia de la base, sin la clave del servidor, no se
puede armar ningún link vivo; con la clave, la app puede volver a mostrarlo
cuando su dueño lo pide.
**Consecuencia:** si se cambia `SHARE_LINK_SECRET`, todos los links ya
compartidos dejan de funcionar. Está dicho en `.env.example`.

**Las métricas se calculan en la base, una sola vez.** `profile_metrics()` es la
única definición de "meses confirmados", "pagos en fecha" y "contratos
cumplidos". La usan el perfil propio y el público, así que no puede haber dos
números distintos para lo mismo. No está otorgada a nadie: se llega a ella por
`my_profile_metrics()` (que usa `auth.uid()`) o por `public_profile()` (que
resuelve desde el token). Nadie puede pedir las métricas de otra persona.

**El perfil público devuelve solo lo que se puede mostrar.** Nunca dirección,
teléfono, mail, comprobantes, notas privadas ni meses sin confirmar. Los montos
se quitan del objeto salvo que la persona los haya activado en ese link: no se
mandan al cliente y se filtran en la vista.

**La imagen de preview y el PDF no cuentan como visitas.** `public_profile()`
recibe `p_contar`: cuando WhatsApp pide la imagen para el preview, o alguien se
baja el PDF, el contador no se mueve. Así el número que ve la persona dice lo
que espera: cuántas veces abrieron su perfil.

**Los barrios sí se muestran.** Es lo único de la ubicación que el propio
CLAUDE.md marca como público. La dirección completa nunca sale del alquiler.

**Las reseñas llegan en la Fase 5.** El perfil ya tiene su lugar en la página y
en el PDF; hoy muestra métricas y niveles de verificación.

## Identidad: el lockup del header

El header del sitio y de la app usan el lockup con el símbolo como punto final:
wordmark grande, símbolo a la derecha, a la mitad de la altura de las mayúsculas
y apoyado en la base del texto, separado por medio radio. Va en versión media
(un diente por llave) porque al lado del texto dos dientes hacen ruido, y se
recorta al contorno real del dibujo: si se deja el aire del `viewBox`, esa
separación de medio radio se pierde.

El lockup con el símbolo a la izquierda sigue en el pie, en el recibo, en el
perfil en PDF y en las pantallas de ingreso e invitación. Está documentado en
`docs/identidad.md` y hay un test end to end que mide la proporción y la
separación, para que no se desarme sin que nos enteremos.

## Fallas y diagnóstico

**Una tarea secundaria no puede voltear la acción principal.** El rate limiting
y la bitácora son protecciones de segundo orden: si no están configuradas o
fallan, se registran en los logs y la persona igual puede hacer lo que vino a
hacer. Antes, una variable de entorno faltante hacía que la acción entera
explotara sin mostrar nada en pantalla.

**Contrapartida asumida:** sin `RATE_LIMIT_SALT` o sin
`SUPABASE_SERVICE_ROLE_KEY` el rate limiting queda apagado. Preferimos eso a
dejar a la gente afuera de la app, pero es una protección menos: `/api/salud`
lo marca y el servidor lo avisa en los logs. Hay que configurarlas.

**Todo error inesperado se muestra con un código.** `conRedDeSeguridad()`
envuelve cada acción del servidor: si algo tira una excepción, se convierte en
un mensaje en pantalla con una referencia corta que también queda en los logs
como `[inkey:xxxxxx]`. Nada de fallar en silencio.

**Un error de campo nunca queda escondido.** El alta de alquiler tiene pasos: si
el servidor rechaza un campo de otro paso, el cartel aparece arriba de todo y
ofrece ir hasta ese paso. Hay un test que comprueba que todos los campos del
formulario pertenecen a algún paso.

**`/api/salud` no pide sesión.** Reporta solo nombres de variables faltantes y
el estado de las revisiones, nunca valores. Poder diagnosticar una instalación
rota desde el navegador vale más que esconder que, por ejemplo, falta cargar una
clave.

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
