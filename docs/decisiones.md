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

**Todos los headers llevan el mismo lockup**: wordmark grande y símbolo chico a
la derecha, como punto final, apoyado en la línea de base y separado por medio
radio. El símbolo no crece con el wordmark: quedó en unos dos quintos de la
altura de las mayúsculas. Va en versión media (un diente por llave) y recortado
al contorno real del dibujo, porque si se deja el aire del `viewBox` esa
separación de medio radio se pierde.

**El lockup de header es el valor por defecto del componente `Logo`.** Una
pantalla nueva que escriba `<Logo />` ya queda con el orden correcto: para el
otro lockup hay que pedirlo explícitamente. Además, las pantallas simples
(ingreso, onboarding, invitación, perfil público) comparten el componente
`Cabecera`, así que no hay cuatro headers distintos que se puedan desincronizar.

El lockup con el símbolo a la izquierda quedó solo para lo que no es header:
pie, recibo, perfil en PDF y mails.

Hay un test end to end que recorre las cuatro pantallas con header alcanzables
sin sesión y verifica, en cada una, que el símbolo esté a la derecha del
nombre, con la proporción, la separación y la línea de base correctas.

## Fin de contrato y reseñas (Fase 5)

**El contrato termina de a dos.** Uno marca "terminó" y el otro confirma. Que
una sola persona pudiera cerrar un alquiler compartido sería darle la última
palabra sobre el historial del otro. Quien lo propuso puede dar marcha atrás
mientras nadie confirmó, y no puede confirmárselo a sí mismo.

**Al confirmar el fin, `end_date` pasa a hoy** si estaba vacía o era posterior:
así los meses del alquiler dejan de crecer y las métricas cierran donde
corresponde.

**Las reseñas se publican juntas, estilo Airbnb.** Se guardan enseguida pero no
se muestran hasta que estén las dos, o hasta 14 días después del fin del
contrato. Así nadie escribe condicionado por lo que dijo el otro.

**Esa regla vive en la base, no en el código.** `resena_visible()` la evalúa, y
la usan tanto la política de RLS como el perfil público. Eso significa que
funciona **sin cron**: pasados los 14 días la reseña se puede mostrar aunque
nadie haya corrido nada. `reviews_publish_due()` existe para materializar
`published_at` y la va a llamar el cron en la Fase 6, pero no es de lo que
depende la regla.

**Una reseña no se edita ni se borra.** Un trigger lo impide. Se escribe una
vez, y una sola por persona y por alquiler.

**Las etiquetas viven en una tabla, no en el código.** Las del inquilino y las
del dueño son distintas, y el catálogo se puede ampliar sin migrar nada. La
función valida que cada etiqueta exista, esté activa y corresponda a la
dirección de esa reseña: no se puede colar una etiqueta del otro lado.

**El perfil público no dice quién escribió cada reseña.** Solo "Su dueño" o "Su
inquilino". Alcanza para saber que viene de la otra parte de ese alquiler, y no
expone a nadie de más.

**Todas las etiquetas son afirmaciones positivas.** No hay etiquetas negativas
ni puntaje: el producto no tiene forma de marcar mal a nadie.

## Notificaciones (Fase 6)

**El mail es una tarea secundaria y nunca rompe nada.** Si `RESEND_API_KEY` no
está, la app funciona igual: el aviso queda registrado con su error y la acción
principal (reportar, confirmar, aceptar) ya está guardada antes de que se
intente mandar nada. Ningún `enviarMail` tira una excepción hacia afuera.

**El remitente sale entero de `EMAIL_FROM`.** No hay ningún dominio escrito en
el código. Mientras no haya dominio propio se usa el de prueba de Resend
(`onboarding@resend.dev`, que solo escribe a la casilla de la cuenta); cuando
el dominio esté verificado, se cambia la variable y se vuelve a deployar. Los
pasos de la verificación (DKIM, SPF, MX, DMARC) están en el README.

**`dedupe_key` en la base, no un flag en el código.** Cada aviso se reserva
antes de mandarse con una clave única que describe el hecho y el destinatario
(`pago.recordatorio:<pago>:<reported_at>`). Si el cron corre dos veces, la
segunda no manda nada; y si el inquilino vuelve a reportar, la clave cambia y
el recordatorio se puede volver a mandar.

**El link del mail confirma un pago y nada más.** `action_tokens`: 32 bytes
aleatorios de los que se guarda solo el hash, 72 horas de vida, un solo uso y
una sola acción sobre un solo pago. No abre sesión. Quien tenga el link puede
responder ese pago, igual que quien tenga la casilla del dueño; por eso dura
poco y queda en la bitácora como hecho `via: mail`.

**El recordatorio por WhatsApp del inquilino NO lleva el link del mail.** A los
7 días sin respuesta, el inquilino puede escribirle al dueño; ese mensaje lleva
a `/pagos/<id>`, que pide sesión. Si llevara un token de acción, el inquilino
podría abrirlo él mismo y confirmarse su propio pago: el historial dejaría de
valer, que es lo único que sostiene el producto.

**La invitación por mail la manda el servidor, no un `mailto:`.** Antes de
mandar, se verifica que el token sea de una invitación viva de un alquiler de
quien lo pide: nadie puede usar nuestro remitente para mandar cualquier cosa a
cualquier lado. El `mailto:` queda como alternativa, para quien prefiera
escribirlo desde su propio correo.

**El cron va cerrado por `CRON_SECRET`.** Sin la variable el endpoint devuelve
503 en vez de quedar abierto. Corre una vez por día (13:00 UTC, 10:00 en
Argentina): recuerda los pagos sin responder a los 3 días y materializa las
reseñas que cumplieron sus 14 días.

**Las tablas de avisos no las ve la app.** `notifications` y `action_tokens`
están revocadas para `anon` y `authenticated`: se tocan solo con el service
role o a través de las funciones `security definer`. Por eso `/api/salud` las
revisa con el cliente de administración: si dieran "ok" con el otro, sería una
mala noticia.

## Dominio propio e ingreso (revisión de infraestructura)

**Ningún dominio está escrito en el código.** Los links de los mails, las URLs
canónicas, el `robots.txt` y el sitemap salen todos de `NEXT_PUBLIC_SITE_URL`.
Cambiar de dominio es cambiar una variable y volver a deployar.

**`metadataBase` en el layout raíz.** Sin eso, Next arma las URLs absolutas de
los metadatos con la URL del deploy de Vercel: el preview de WhatsApp de un
perfil compartido terminaba sirviendo la imagen desde `*.vercel.app`. Ahora
sale del dominio configurado.

**Canónica y `robots.txt`.** El sitio responde por tres nombres (dominio con
`www`, sin `www` y la URL del deploy). La landing declara su canónica y el
`robots.txt` marca el host bueno, así no compiten entre sí en los buscadores.
Lo privado, además del `noindex` de cada pantalla, queda cerrado en la puerta.

**Subdominio de envío para Resend.** Los mails salen de `mail.<dominio>` y no
del dominio pelado. En el dominio raíz vive el correo de Google Workspace, y
solo se permite un SPF por nombre: verificar el subdominio deja intactos el MX,
el SPF y el DKIM de Google. Si algún día la reputación de envío se arruina,
tampoco arrastra al correo de las personas.

**Remitente y respuesta separados.** `EMAIL_FROM` es la casilla de la que salen
los avisos; `EMAIL_REPLY_TO`, la que alguien lee. Si una persona contesta un
aviso, tiene que llegarle a alguien: un `no-responder@` sin `reply-to` es una
puerta cerrada.

**Los mails de ingreso los manda Supabase, no nuestro código.** Por eso sus
plantillas viven aparte, en `supabase/templates/`, en castellano y con la misma
identidad. Se cargan a mano en el panel; el repo es la fuente.

**Un link de ingreso muerto ya no deja a nadie mirando la landing.** Supabase
rebota al Site URL con el error en la query o en el fragmento. El proxy ataja
la query y un componente chico del layout ataja el fragmento (que no viaja al
servidor), y los dos llevan a `/ingresar` con un mensaje claro. El texto lo
ponemos nosotros a partir de un código conocido: nunca se muestra lo que venga
escrito en la URL.

**Código de 6 dígitos además del link.** Varios servicios de correo abren los
links solos para revisarlos, y un magic link es de un solo uso: cuando la
persona lo toca, ya está gastado. El código va en el mismo mail, se escribe en
la misma pantalla donde se pidió, y funciona aunque el link no exista más o se
abra en otro dispositivo. Pasa por el mismo rate limiting que el link.

**`supabase/verificar.sql`.** Las migraciones se aplican a mano en el SQL
Editor, así que hace falta poder responder "¿están todas?" sin adivinar. El
script lista cada tabla, función y bucket esperado con `ok` o `FALTA`, dice qué
migración lo trae, y cuenta las tablas de `public` sin RLS (tiene que dar 0).

## Deploy en Vercel (plan Hobby)

**`vercel.json` no admite comentarios, ni siquiera con nombre de propiedad.**
Vercel valida ese archivo contra su esquema antes de compilar: una propiedad
que no conoce —teníamos un `comment` explicando el horario del cron— hace
fallar el deploy en dos segundos, sin build y sin log útil. Dentro de un cron
van `path` y `schedule`, y nada más. La explicación vive en el archivo de la
ruta, que es código y sí se puede comentar.

**Un solo cron diario.** Hobby permite hasta dos tareas y como mucho una por
día. Una expresión más frecuente no se degrada a diaria: rechaza el deploy. La
tarea diaria hace las dos cosas (recordatorios y publicación de reseñas), que
miden en días; que Vercel dispare en cualquier momento de esa hora no cambia
nada. Si algún día hiciera falta más frecuencia, el endpoint lo puede llamar
cualquier programador externo con el header del secreto, sin tocar código ni
pagar plan.

**Un test guarda el `vercel.json`.** Ese error no lo veía ningún test de la
app: el deploy fallaba, y el sitio seguía mostrando la versión anterior como si
nada. `tests/unit/despliegue.test.ts` revisa las propiedades, que el endpoint
exista y que la frecuencia entre en Hobby.

**Una variable mal cargada no puede voltear el build.** `metadataBase` hacía
`new URL(NEXT_PUBLIC_SITE_URL)` al cargar el layout: cargarla sin `https://`
tiraba abajo la compilación entera, no solo los links. Ahora `serverEnv.siteUrl`
normaliza (completa el protocolo, saca la barra final) y, si no hay nada
usable, cae a localhost avisando por consola.

## Ajustes después de la primera prueba real

**El largo del código lo decide Supabase, no nosotros.** Llegó uno de 7 dígitos
y la pantalla lo rechazó siendo válido: el campo pedía exactamente 6. Ahora
acepta de 6 a 10 (`LARGO_CODIGO`), que es el rango que permite "Email OTP
Length". Una opción del panel no puede dejar a nadie afuera.

**El encabezado de los mails también es un encabezado.** Tenía el símbolo a la
izquierda, como el pie. La regla de identidad no distingue soportes: en un
encabezado va siempre el nombre primero y el símbolo de remate. Se corrigieron
las cinco plantillas de Supabase y las de la app, y un test lo verifica en las
seis, para que una plantilla nueva no nazca al revés.

**En los mails el símbolo es PNG, no SVG.** Gmail y Outlook no muestran SVG. Se
exporta del mismo archivo de marca con Chromium, al triple de tamaño para
pantallas retina, y se muestra a 24 × 9. El wordmark sigue siendo texto: si el
cliente bloquea las imágenes, la marca se lee igual.

**El archivo de marca manda sobre el componente.** `public/brand/` guarda la
geometría de la versión media, y un test compara caja, dientes, arco del cruce,
grosor y colores contra el componente. Se corrigieron de paso las cajas
ajustadas: estaban calculadas a ojo y sobraba aire a la derecha.

## Cuenta y privacidad (Fase 7)

**La baja despersonaliza, no borra.** Es la política acordada en su sección de
arriba, ya implementada: `account_delete()` limpia el perfil, revoca los links,
oculta las reseñas recibidas y programa los archivos para dentro de 30 días.
Los alquileres y los pagos confirmados siguen existiendo para la contraparte,
que no pidió nada y cuyo historial también es suyo.

**La fila de `auth.users` sobrevive a la baja.** Es lo que sostiene el historial
de la otra parte. Lo que se libera es el mail: se cambia por uno inválido con la
API de administración, así esa persona puede volver a registrarse con su
dirección de siempre y empezar de cero. Borrar la fila habría sido más prolijo
en apariencia y destructivo en los hechos.

**El borrado de los archivos lo hace el cron, no la baja.** La baja solo
programa; el cron diario borra lo que ya cumplió los 30 días. Así el plazo se
respeta aunque nadie esté mirando, y la contraparte recibe su aviso apenas la
baja ocurre.

**El export no incluye datos personales de la otra parte.** Están los alquileres
compartidos, los pagos y las reseñas, pero no el nombre ni el teléfono de la
contraparte: los datos personales de otro no son datos de quien exporta.

**El CSV se arma por secciones.** Los datos no son una sola tabla. Un archivo
con un encabezado por sección, con BOM para que Excel no rompa los acentos y con
las celdas que empiezan con `=` neutralizadas, se abre en cualquier planilla.

**Los tests de flujo viven en el mismo arnés que los de RLS.** Levantan el mismo
Postgres efímero y llaman a las mismas funciones que la app. Un Playwright con
sesión de verdad necesitaría un Supabase real corriendo, que en este entorno no
hay: lo que se puede probar sin backend se prueba con Playwright, y el recorrido
completo del negocio se prueba contra la base.

## Límites de frecuencia (cierre de la auditoría)

**Toda acción que escribe pasa por el limitador, salvo una.** Se sumaron
confirmar un pago, dejar una reseña y exportar los datos. La excepción es
darse de baja: es un derecho, y un limitador no puede dejar a nadie encerrado
en su cuenta. La excepción está escrita en el test, con su motivo.

**El límite de confirmación cubre también el link del mail.** Ahí no hay
sesión, así que es la única parte de los pagos expuesta a cualquiera con el
link: es donde más falta hacía.

**El test lee el código, no la intención.** `tests/unit/limites.test.ts`
recorre `src/app`, busca quién llama a una función que escribe y exige el
limitador o una excepción con motivo. Acordarse no es un mecanismo.

## El logo, en una sola forma

**Una forma para todos los tamaños.** Antes había tres versiones (completa,
media, mínima) y quedó la que era mínima: sin dientes, trazo 8. Tres versiones
eran tres cosas que mantener sincronizadas —el componente, el archivo, el
ícono, el PDF, el PNG de los mails— y a los tamaños que usamos de verdad el ojo
no distinguía los dientes.

**Los colores salen de los tokens, no del archivo.** El archivo de marca los
trae fijos porque se usa donde no hay CSS (mails, favicon); el componente usa
`var(--primary)` y `var(--confirm)`, y por eso el modo oscuro los aclara solo,
sin una segunda copia del dibujo.

**El verde del logo es la única excepción a la regla del verde.** En la
interfaz el verde significa *confirmado* y nunca es decorativo. En el logo, que
cada llave tenga su color es lo que cuenta de qué se trata el producto: son dos
partes. La excepción está escrita en `docs/identidad.md` para que no se lea
como un descuido.

**El recorte en vez de la muesca.** Con una sola tinta, el aro de atrás se
recorta con un `clipPath` en regla `evenodd`. Antes se tapaba con una muesca
del color del fondo, lo que obligaba a saber el fondo: sobre otro fondo
aparecía la muesca. El recorte funciona sobre cualquiera.

**El id del recorte lo pone quien usa el componente.** Un contador de módulo
sería estado mutable durante el render —lo rechaza el linter de React, y con
razón: se rompe con render concurrente— y un valor al azar no sobreviviría a la
hidratación. El tipo exige el id, así la unicidad queda a la vista.

## Textos legales

**Las páginas se arman del markdown, no de una copia.** Los textos viven en
`docs/legales/*.md` y `/terminos` y `/privacidad` los renderizan. Con dos
copias, tarde o temprano una dice algo distinto de la otra, y en un texto legal
eso es exactamente lo que no puede pasar.

**Un parser chico en vez de una dependencia.** El markdown que usan estos
textos es títulos, párrafos, listas con un nivel de anidado, negritas y links.
Traer `react-markdown` para eso sería sumar una dependencia y perder el control
de la tipografía. El parser está en `src/lib/legales.ts` y tiene sus tests.

**Son las dos únicas pantallas indexables además de la landing.** Alguien tiene
que poder leer qué hacemos con sus datos sin crear una cuenta. Están en el
sitemap y no llevan `noindex`.

**El pie es uno solo, en todas las pantallas.** Antes solo la landing tenía pie.
El contacto y los legales tienen que estar a un toque desde cualquier lado: es
lo que pide la ley y lo que espera cualquiera que quiera saber algo.

**Un test falla si queda un placeholder.** Un texto legal publicado con un
`[CORCHETE]` sin completar dice que nadie lo leyó antes de publicarlo. Hay un
test sobre los archivos y otro que mira las pantallas renderizadas.

## Lanzamiento: se va la lista de espera

**Registrarse e ingresar son el mismo flujo.** Sin contraseñas no hay dos
caminos: el mail llega, se toca el link o se escribe el código, y si la cuenta
no existe se crea sola. Por eso "Empezá gratis" y "Ya tengo cuenta · Ingresar"
llevan al mismo lado. Lo único que cambia es qué espera la persona, y eso lo
resuelve el texto, no una pantalla aparte.

**El rol viaja por la URL hasta el onboarding.** Lo elegido en la landing entra
como `?intencion=`, se guarda en un campo oculto del ingreso, sobrevive al
viaje por el mail dentro del link de vuelta y llega al onboarding, que ya lo
sabía leer. Se valida contra la lista de intenciones en cada salto: lo que
viene de una URL no se usa a ciegas. Es una preselección, no una decisión
cerrada: en Inkey el rol es de cada alquiler, no de la cuenta.

**La tabla de la lista de espera queda.** Se fueron el formulario, su acción y
su límite de frecuencia, pero los datos no: esas personas pidieron que les
avisáramos. La tabla sigue cerrada para `anon` y `authenticated`, sus tests de
RLS siguen corriendo, y `supabase/lista-de-espera.sql` saca la lista de a
quién falta avisarle, sin los que ya se crearon la cuenta solos.

**La política de privacidad dice Estados Unidos, no Brasil.** La región de
Supabase es `us-west-2` (Oregon). La Argentina no considera a Estados Unidos un
país de protección adecuada, así que el artículo 12 de la Ley 25.326 no se
cumple solo con el consentimiento: el texto ahora nombra también las garantías
contractuales con cada proveedor. Un país equivocado en una política de
privacidad no es un detalle de redacción.

## El hero, después del lanzamiento

**Dos caminos, uno por lado del alquiler.** En vez de un selector que hay que
tocar antes de poder avanzar, cada rol tiene su acción: "Crear mi historial"
(botón, para el inquilino, porque el historial es suyo) y "Tengo una propiedad
en alquiler →" (link de texto, que pesa menos sin esconderse). Cada uno lleva
su `?intencion=`, así que el selector dejó de ser un paso y pasó a ser una
consecuencia de en qué tocaste.

**Sin caja blanca y sin formulario.** No hay nada que completar en la landing:
entrar es tocar un botón y mirar el mail. La caja solo enmarcaba un formulario
que ya no existe.

**"Ingresar" aparece una sola vez, en el header y de contorno.** Antes había
tres llamados compitiendo (el botón del header, el principal y el "ya tengo
cuenta"). Quien ya tiene cuenta busca arriba a la derecha; quien no, busca el
botón grande.

**Se va la palabra "gratis" de toda la landing.** El precio está en los
términos y en la letra chica de la app; repetirlo en cada botón lo convierte en
el argumento, y el argumento es el historial. Un test lee la página renderizada
y falla si vuelve a aparecer.

**La tarjeta de ejemplo muestra una sola cosa grande.** Tres métricas del mismo
tamaño son tres cosas que nadie mira: ahora manda el número de meses
confirmados y el resto acompaña en chico. La tira de doce meses perdió los
nombres —no importa cuál es cada mes, importa que están todos— y quedaron las
puntas como referencia.

**La notificación flotante es el momento en que el producto cumple.** Se apoya
sobre el borde de la tarjeta, no adentro, para que se lea como algo que acaba
de pasar y no como parte del perfil. Va sobre fondo tinta siempre, así que el
verde del check tiene su propio token (`--invertido-confirm`): el `confirm` del
modo claro no tiene contraste suficiente ahí.

**El hero ocupa la primera pantalla.** `content-center` centra el bloque entero
y `items-start` alinea las dos columnas por arriba: el eyebrow empieza donde
empieza la tarjeta. Centrar cada columna por separado dejaba doscientos píxeles
de aire arriba del texto, que era justo lo que había que sacar.

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

## El chequeo de salud pregunta lo que corresponde

**Las tablas se revisan con el service role, no con el cliente de la app.** El
chequeo preguntaba "¿podés leer `rentals`?" sin sesión, y la respuesta correcta
a esa pregunta es *no*: `anon` no tiene ningún permiso sobre las tablas
privadas. Estaba reportando como falla la seguridad funcionando.

**Ninguna revisión usa `head: true`.** Una respuesta HEAD no trae cuerpo, así
que el error de PostgREST llegaba vacío: `error (?): `, sin código y sin
mensaje. Con `limit(0)` el cuerpo viene igual (una lista vacía, sin datos de
nadie) y el error trae código, mensaje y pista.

**Tampoco se pregunta por una columna que quizá no existe.** `select("id")`
fallaba en `review_tag_defs`, cuya clave es `code`. Un diagnóstico no puede
depender de la forma de cada tabla: `select("*").limit(0)` alcanza para saber
si existe.

**El chequeo sin sesión usa un cliente sin las cookies del pedido.** Si usara
la sesión de quien abre la página, diría que las tablas privadas "se ven" y
sería mentira: se ven porque esa persona entró.

**Y ahora afirma lo positivo, no solo lo negativo.** Los renglones `cerrado:*`
dicen `ok` cuando una visita NO puede leer una tabla privada, y gritan
`¡ABIERTA!` si alguna vez devuelve filas. Lo mismo con el bucket: avisa si
dejara de ser privado.

**Todo en paralelo.** En serie, con algo que no responde, el diagnóstico
tardaba casi un minuto: justo cuando más lo necesitás. Ahora tarda lo que la
revisión más lenta.

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
