# Plantillas de los mails de ingreso (Supabase)

Estos son los mails que manda **Supabase Auth**, no la app: el del link para
entrar y el de la primera vez. Los de la app (pagos, invitaciones, reseñas)
viven en `src/lib/email/plantillas.ts` y no se tocan desde acá.

## Cómo se cargan

Panel de Supabase → **Authentication → Emails → Templates**. Una pestaña por
plantilla. De cada archivo:

- el **asunto** está en la primera línea, después de `Subject:`;
- el **cuerpo** es todo lo que sigue: copialo entero en el campo del mensaje.

Van las cinco de `bilingue/`, una en cada pestaña:

| Archivo | Pestaña de Supabase | Cuándo se manda |
| --- | --- | --- |
| `bilingue/magic-link.html` | Magic Link | Cada vez que alguien pide entrar. |
| `bilingue/confirmar-alta.html` | Confirm signup | La primera vez, cuando se crea la cuenta. |
| `bilingue/invitacion-usuario.html` | Invite user | Cuando se invita a alguien desde el panel de Supabase. |
| `bilingue/cambio-de-mail.html` | Change Email Address | Cuando alguien cambia su mail. |
| `bilingue/reingreso.html` | Reauthentication | Antes de una acción sensible, para confirmar identidad. |

La pestaña **Reset Password** queda como viene: Inkey no usa contraseñas.

## El encabezado

Nombre primero y símbolo después, a la derecha, como en todos los encabezados
(ver `docs/identidad.md`). El símbolo es un PNG servido por el sitio
(`{{ .SiteURL }}/brand/inkey-simbolo.png`), porque Gmail y Outlook no
muestran SVG. Entre `</span>` y `<img` no puede haber ni un espacio.

## Las variables

| Variable | Qué es |
| --- | --- |
| `{{ .ConfirmationURL }}` | El link que entra directo. |
| `{{ .Token }}` | El código de 6 dígitos. **Sin esto, el código no se manda.** |
| `{{ .SiteURL }}` | El dominio configurado como Site URL. |

El código de 6 dígitos y el link son dos caminos al mismo lugar, y los dos
tienen que estar: algunos servicios de correo abren los links solos para
revisarlos y los gastan antes de que la persona los toque. La pantalla para
escribir el código es `/ingresar`, después de pedir el mail.

## Las versiones bilingües (`bilingue/`) — las que conviene cargar

Las cinco, con el castellano arriba y una versión corta en inglés abajo,
separadas por una línea. Como el botón y el código son los mismos para los
dos, el bloque en inglés no los repite: dice qué es y remite a lo de arriba.

El asunto también va en los dos idiomas, separado con `·`, porque es lo
primero (y a veces lo único) que se ve en la bandeja de entrada. El
castellano va adelante: en el celular, el inglés puede quedar cortado, pero
alcanza para reconocer el mail.

**Estas son las que hay que cargar en Supabase**, porque resuelven de una vez
lo que Supabase no puede resolver solo (ver abajo). El pie también va en los
dos idiomas.

## Las versiones en inglés

En `en/` están las mismas cinco plantillas traducidas.

Una advertencia que importa: **Supabase manda una sola plantilla para todo el
mundo**. No sabe en qué idioma usa la app cada persona —y en el mail de alta
todavía no hay cuenta ni preferencia guardada—, así que no puede elegir. Los
mails de la app (pagos, invitaciones, reseñas) sí salen en el idioma de quien
los recibe, porque los arma Inkey leyendo el perfil.

Entonces hay tres opciones:

- **bilingüe** (`bilingue/`), que es la recomendada: todo el mundo entiende
  su mail sin que tengamos que elegir por nadie;
- **castellano** (los archivos de esta carpeta), si algún día el inglés se
  apaga del todo;
- **inglés** (`en/`), si el público cambia.

Si hiciera falta que cada persona lo reciba en su idioma, habría que sacarle
a Supabase el envío de estos mails y mandarlos desde la app con Resend, como
los demás. No está hecho: es una decisión de producto, no una tarea pendiente.
