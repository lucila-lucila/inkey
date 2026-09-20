Inkey — Especificación del MVP para Claude Code

Tu rol y cómo trabajar

Vas a construir el MVP de Inkey, una web app para Argentina. Trabajá por fases (ver al final). Antes de escribir código:

1. Leé este documento completo y `docs/identidad.md` (la identidad de marca: define el look & feel). `reference/landing.html` es la landing de la Fase 1 y queda como referencia histórica de la estructura de la página, no de su estilo.
2. Proponeme el esquema de base de datos, la estructura de carpetas y el plan de la Fase 1. Esperá mi OK antes de implementar.
3. Al terminar cada fase: corré los tests, mostrame qué quedó hecho, qué falta y cómo probarlo localmente. Hacé commit con un mensaje claro.
4. Si algo es ambiguo, preguntame. No inventes textos legales: dejá placeholders como `[TÉRMINOS Y CONDICIONES]`.

Toda la interfaz va en español rioplatense con voseo ("Confirmá", "Subí el comprobante"), tono cercano pero confiable.

Qué es Inkey

Un historial de alquiler confirmado entre inquilino y dueño. Cada mes, el inquilino marca que pagó (con comprobante) y el dueño confirma "recibido". Ese historial es del inquilino: lo comparte con un link cuando busca su próximo alquiler. Al terminar un contrato, ambos se dejan una reseña (reputación en las dos direcciones).

Principios de producto (no negociables):

* El historial es del inquilino. Él decide si lo comparte y con quién. Nada es público por defecto.
* Solo se muestra lo positivo confirmado. Un mes sin confirmar simplemente no suma. No existen listas de morosos, marcas negativas públicas ni "escraches".
* Sin datos crediticios. No consultamos bancos, Veraz ni scoring de ningún tipo.
* Mínima fricción para el dueño. Tiene que poder confirmar un pago en segundos, desde el celular, sin contraseña.
* Mobile first. La mayoría va a usarlo desde el teléfono, llegando por un link de WhatsApp.

Stack

* Next.js (App Router, TypeScript) + Tailwind CSS
* Supabase: Auth (magic link por email y login con Google), Postgres con Row Level Security en todas las tablas, Storage privado para comprobantes y contratos
* Resend para emails transaccionales
* Vercel para deploy, con Vercel Cron para recordatorios
* Generación de PDF de recibos del lado del servidor (por ejemplo `@react-pdf/renderer`)
* Tests: Vitest para lógica, Playwright para los flujos principales

Si creés que alguna pieza conviene cambiarla, proponelo con el motivo antes de hacerlo.

Roles

Una misma cuenta puede ser inquilino, dueño o ambos (alguien puede alquilar donde vive y tener otro departamento en alquiler). El rol no es un atributo de la cuenta sino de cada alquiler: en un contrato sos inquilino, en otro sos dueño. En el onboarding se pregunta "¿Qué querés hacer primero?" solo para decidir qué pantalla mostrar.

Modelo de datos (propuesta, ajustala y justificá cambios)

* profiles: `id` (= auth user), `first_name`, `last_name`, `phone`, `avatar_url`, `created_at`, `accepted_terms_at`.
* rentals: `id`, `tenant_id`, `owner_id` (nullable hasta que acepte), `created_by`, `neighborhood_label` (barrio y ciudad, lo único que puede verse en el perfil público), `full_address` (privada), `start_date`, `end_date`, `monthly_amount`, `currency` (ARS/USD), `due_day` (día de vencimiento), `adjustment_index` (texto libre: ICL, IPC, fijo, otro), `adjustment_every_months`, `contract_path` (opcional), `status` (`pending` | `active` | `ended` | `rejected`), timestamps.
* invitations: `id`, `rental_id`, `invited_role` (`owner` | `tenant`), `token_hash` (guardá solo el hash; el token va en el link), `expires_at` (7 días), `accepted_at`, `accepted_by`.
* payments: `id`, `rental_id`, `period` (YYYY-MM, único por alquiler), `amount`, `paid_on`, `receipt_path` (opcional), `status` (`reported` | `confirmed` | `not_received`), `reported_at`, `confirmed_at`, `confirmed_by`, `owner_note` (privada).
* reviews: `id`, `rental_id`, `author_id`, `subject_id`, `direction` (`tenant_to_owner` | `owner_to_tenant`), `text`, `tags` (array de etiquetas predefinidas, por ejemplo "Siempre al día", "Cuidó la propiedad", "Resolvió arreglos rápido", "Devolvió el depósito"), `created_at`, `published_at`.
* share_links: `id`, `user_id`, `token` (aleatorio, no adivinable), `created_at`, `revoked_at`, `view_count`, `show_amounts` (bool, por defecto false).
* audit_log: acciones sensibles (confirmaciones, invitaciones aceptadas, links creados y revocados, borrado de cuenta).

Reglas de negocio

* Puntualidad: un pago cuenta como "en fecha" si está `confirmed` y `paid_on` es menor o igual al día de vencimiento de ese período.
* Meses confirmados: cantidad de pagos `confirmed` sumando todos los alquileres del inquilino.
* Contratos cumplidos: alquileres `ended` con al menos un pago confirmado.
* `not_received` es privado entre las partes: nunca aparece en el perfil público ni afecta métricas públicas. El inquilino puede volver a reportarlo; el dueño puede cambiarlo a `confirmed`.
* Reseñas estilo Airbnb: se publican cuando ambos dejaron la suya o a los 14 días del fin del contrato, lo que pase primero. Así nadie escribe condicionado por lo que dijo el otro.
* Niveles de verificación visibles en el perfil: "Confirmado por el dueño", "Con comprobante", "Con contrato adjunto".

Flujos

1. Registro e ingreso

* Magic link por email o Google. Sin contraseñas.
* Onboarding corto: nombre, apellido, celular, aceptación de términos y privacidad (casillas explícitas, no premarcadas) y "¿Qué querés hacer primero?": registrar mi alquiler como inquilino / registrar una propiedad como dueño.

2. Inquilino registra su alquiler

* Formulario en pasos cortos: dirección, barrio, fechas, monto, moneda, día de vencimiento, índice y frecuencia de ajuste, contrato opcional.
* Al final: invitar al dueño. Botón "Enviar por WhatsApp" que abre `wa.me` con un mensaje armado y el link de invitación, más la opción de enviar por email o copiar el link.
* El alquiler queda `pending` hasta que el dueño acepte.

3. Dueño recibe la invitación

* Abre el link, ve un resumen del alquiler y quién lo invita.
* Para aceptar, se identifica con magic link (email) o Google; si no tiene cuenta se crea en el momento, con el mínimo de datos.
* Puede aceptar o marcar "No soy el dueño de esta propiedad" (el alquiler pasa a `rejected` y se avisa al inquilino).

4. Dueño registra una propiedad e invita al inquilino

* Mismo flujo que el 2, pero iniciado por el dueño. Un dueño puede tener varias propiedades.

5. Pago mensual

* El inquilino ve el período actual y toca "Ya pagué": monto (prellenado), fecha de pago y comprobante opcional (imagen o PDF, máximo 10 MB).
* El dueño recibe un email y ve la tarjeta pendiente con dos botones grandes: "Recibido" y "Todavía no me llegó". Desde el email, un link firmado lo lleva directo a la confirmación.
* Al confirmar se genera un recibo en PDF descargable para ambos.
* Si el dueño no responde en 3 días, recordatorio por email. Si pasan 7 días, el inquilino ve la opción de reenviarle el aviso por WhatsApp.

6. Perfil compartible del inquilino

* Desde su panel, el inquilino crea un link (puede tener varios y revocarlos).
* Página pública `/p/[token]`: nombre y inicial del apellido, meses confirmados, porcentaje de pagos en fecha, contratos cumplidos, barras de los últimos 12 meses, niveles de verificación y reseñas publicadas.
* Nunca muestra dirección completa, teléfono, email, comprobantes ni meses `not_received`. Los montos solo si el inquilino activa `show_amounts`.
* Debe verse muy bien en el celular y tener un buen preview al compartirse por WhatsApp (Open Graph).
* Tiene que existir una versión en PDF descargable del mismo perfil.

7. Perfil del dueño

* Su reputación como dueño: reseñas publicadas de sus inquilinos y cantidad de contratos. Mismo sistema de links compartibles.

8. Fin de contrato

* Cualquiera de las partes marca "Terminó el contrato"; la otra confirma. El alquiler pasa a `ended`.
* Ambos reciben la invitación a dejar su reseña: etiquetas rápidas y un texto opcional de hasta 500 caracteres.

9. Cuenta y privacidad

* Editar datos personales.
* Descargar mis datos (JSON o CSV) y borrar mi cuenta, en cumplimiento de la Ley 25.326. Definí y documentá qué pasa con los registros compartidos cuando una de las partes borra su cuenta y proponémelo antes de implementarlo.

Pantallas

* `/` → landing (la estructura de secciones sale de `reference/landing.html`; el estilo, de `docs/identidad.md`)
* `/ingresar`, `/onboarding`
* `/panel` → resumen: tareas pendientes primero ("Confirmá el pago de octubre"), después alquileres como inquilino y propiedades como dueño
* `/alquileres/nuevo`, `/alquileres/[id]` (detalle, historial de pagos, documentos, invitación)
* `/pagos/[id]` (reportar y confirmar)
* `/invitacion/[token]`
* `/perfil` (mi perfil, links compartibles), `/p/[token]` (público)
* `/cuenta` (datos, privacidad, exportar, borrar)
* Estados vacíos útiles en todas las pantallas: un panel vacío invita a registrar el primer alquiler.

Diseño

Seguí exactamente el sistema visual de `docs/identidad.md` (identidad "Vecindario"): ahí viven la paleta, las tipografías, las formas, el logo, los estados y el tono de voz. Ese documento manda sobre cualquier otra referencia visual.

* `reference/landing.html` sirve solo como referencia histórica de la estructura de la landing (qué secciones hay y en qué orden). Su paleta y su tipografía quedaron viejas: no las uses.
* Modo oscuro con los mismos tokens, respetando `prefers-color-scheme`.
* Accesibilidad: contraste AA, foco visible, labels reales en todos los inputs, respetar `prefers-reduced-motion`.
* Armá los tokens como variables de Tailwind y un set chico de componentes reutilizables antes de las pantallas.

Seguridad (obligatorio)

* RLS en todas las tablas, con tests que prueben que un usuario no puede leer ni modificar alquileres, pagos ni comprobantes ajenos.
* Storage privado; los archivos se sirven solo con URLs firmadas de vida corta y únicamente a las dos partes del alquiler.
* Tokens de invitación y de links compartibles generados con 32 bytes aleatorios; de las invitaciones se guarda solo el hash.
* Validación de todos los inputs del lado del servidor (Zod). Validar tipo real y tamaño de los archivos.
* Rate limiting en login, invitaciones y reporte de pagos.
* Las acciones de confirmación solo pueden ejecutarlas el dueño del alquiler; verificalo en el servidor, no solo en la interfaz.
* Nada de secretos en el cliente. Variables de entorno documentadas en `.env.example`.
* `noindex` en `/p/[token]` y en todo lo que no sea la landing.

Fuera del MVP (no lo construyas)

* Procesar pagos o mover dinero.
* Validación de identidad con DNI o Renaper.
* Integración con la API de WhatsApp Business (usamos links `wa.me`).
* Calculadora de ajustes, integraciones con aseguradoras o inmobiliarias, app nativa.

Dejá la arquitectura preparada para sumarlos después, pero sin código muerto.

Fases

1. Base: proyecto, tokens de diseño, componentes base, auth, onboarding, perfiles, RLS inicial, landing portada.
2. Alquileres e invitaciones: alta de alquiler por ambos roles, invitación por link, aceptar o rechazar.
3. Pagos: reportar, confirmar, `not_received`, comprobantes, recibo PDF.
4. Perfil compartible: métricas, links, página pública, PDF y Open Graph.
5. Fin de contrato y reseñas.
6. Notificaciones: emails transaccionales y recordatorios con cron.
7. Cierre: tests end to end de los flujos principales, seed con datos de ejemplo, revisión de seguridad completa y README con cómo correrlo y deployarlo.

Al terminar la Fase 7, hacé una auditoría de seguridad de todo el repo y listame los riesgos que encuentres, ordenados por gravedad.
