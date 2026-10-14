# Primera cuenta real desde Chrome, sin herramientas locales

## Estado comprobado

Las PR 1–5 están fusionadas y esta preparación parte de `main`. El directorio público y `search_clubs` responden HTTP 200. TypeScript, lint, las 50 pruebas locales y la sincronización de tipos pasan. La exportación de Expo Web genera las pantallas y `auth/callback.html`. La revisión en Chromium comprueba validaciones, metadatos de registro, callback del origen, PKCE S256 y errores de login/callback, interceptando todas las peticiones a Supabase antes de que salgan del navegador de prueba. No valida un registro exitoso ni envía correos. Se ha corregido un error de hidratación de React al abrir la página estática de callback con parámetros.

Esta sesión de Codex no dispone de una herramienta de exposición pública de puertos y GitHub Pages no está habilitado para el repositorio. El servidor de comprobación local no se puede ofrecer como dirección para Chrome en Windows. No hay todavía una URL HTTPS de pruebas desplegada y verificada. El callback móvil autorizado `convosquad://auth/callback` no sustituye a un callback de Expo Web.

## Publicar una versión web de pruebas desde el navegador

La preparación incluye `netlify.toml`: Node 24.19, `npm run export:web`, carpeta `dist` y fallback de rutas. No publica ningún sitio automáticamente.

1. Revisa y fusiona la PR de esta preparación cuando esté aprobada.
2. En el navegador abre Netlify, inicia sesión y elige añadir un proyecto mediante importación desde GitHub. Autoriza el acceso al repositorio `cnRoldan/convosquad` y selecciona `main`.
3. Comprueba la configuración: directorio raíz del repositorio, comando `npm run export:web`, directorio de publicación `dist`. El archivo `netlify.toml` define esos valores.
4. Antes de construir, añade estas variables **en Netlify**, disponibles durante la build:
   - `EXPO_PUBLIC_SUPABASE_URL`: la URL de tu proyecto.
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: su clave moderna `sb_publishable_...`.
   - Deja `EXPO_PUBLIC_AUTH_REDIRECT_URL` vacía durante esta primera prueba web: Expo Linking utiliza el origen que abres en Chrome.
5. Ejecuta el despliegue y espera a que el panel indique que está publicado. Copia la dirección HTTPS que Netlify asigna al sitio. Esa es la dirección real para abrir ConvoSquad; no se puede conocer aquí antes de crear el sitio.
6. Abre esa dirección en Chrome y comprueba que aparecen la bienvenida, «Crear una cuenta» e «Iniciar sesión». Abre también la misma dirección con la ruta `/auth/callback`: debe mostrar la pantalla de verificación y avisar de que falta un código, sin un 404. No uses un dominio de preview distinto durante el registro y la confirmación.

Las variables de Codex no se transfieren automáticamente a Netlify. Solo las dos variables públicas anteriores se incorporan al bundle; no uses claves secretas o `service_role`. Si cambias las variables de build, despliega nuevamente.

## Dirección exacta para Supabase Auth

Abre la bienvenida del sitio **publicado** en Chrome. En la consola de DevTools, ejecuta esta expresión de solo lectura:

```js
new URL('/auth/callback', window.location.origin).href
```

Copia el resultado completo. **Ese resultado es la dirección exacta que debes añadir a Redirect URLs** en Supabase → Authentication → URL Configuration. No añadas la URL del proyecto Supabase ni una dirección local de Codex. Establece también Site URL en el origen HTTPS de tu sitio publicado. Puedes conservar el callback móvil autorizado.

Si prefieres fijarlo explícitamente, usa ese mismo resultado en `EXPO_PUBLIC_AUTH_REDIRECT_URL` de Netlify y despliega de nuevo. Nunca lo fijes a `convosquad://auth/callback` para esta prueba de Chrome. Los dominios/URLs de deploy previews son distintos del dominio estable: para la primera cuenta utiliza el estable.

Hasta que exista el sitio y se compruebe su callback público, no se afirma que el callback alojado funcione. Si compartes su URL pública, Codex puede hacer la comprobación de lectura sin crear usuarios.

## Registrar tu primera cuenta

1. En Supabase comprueba Email/Password, registro permitido y confirmación de correo. Revisa SMTP y la plantilla **Confirm signup**: el enlace debe usar `{{ .ConfirmationURL }}` para conservar la verificación y el redirect solicitado por la app. Los valores de `supabase/config.toml` no cambian el proyecto alojado.
2. Si utilizas el envío predeterminado de Supabase, comprueba que tu correo esté permitido por sus restricciones de destinatarios y límites; para correos ajenos al equipo del proyecto configura SMTP propio. La entrega del correo no se ha probado automáticamente.
3. En Chrome abre el sitio publicado, elige «Crear una cuenta» y registra **tú** un nombre único de 3–24 letras ASCII/números/guion bajo, un correo real accesible y una contraseña de al menos ocho caracteres. No entres en «Explorar la demo» para esta prueba.
4. Tras enviar, la app debe pedir que revises el correo. En Supabase → Authentication → Users busca tu dirección: la cuenta debe aparecer todavía pendiente de confirmación. Si no aparece y la app muestra un error, detente y revisa el error y los registros Auth del proyecto; no repitas el alta como si hubiera funcionado.
5. Abre el correo y confirma desde el **mismo perfil de Chrome y el mismo origen** donde comenzaste el registro. Puede ser otra pestaña del mismo perfil. PKCE guarda su verificador en el almacenamiento de ese navegador; otro perfil, incógnito o dispositivo no lo comparte.
6. El enlace verificado debe volver al callback HTTPS con un código. La app lo intercambia por una sesión y navega a «Elige tu club». Una cuenta nueva sin clubes debe ver el estado vacío y las opciones de crear/buscar, sin plantillas de la demo.
7. En Authentication → Users comprueba que la cuenta está confirmada. Si el correo se confirmó desde otro navegador pero el intercambio PKCE falla, vuelve a «Iniciar sesión» en el sitio original; no registres una segunda cuenta.

## Comprobar el perfil sin escribir SQL

En Authentication → Users abre tu cuenta y copia su ID. En Supabase → Table Editor → `public.profiles`, filtra `id` por ese mismo UUID. Debe existir una sola fila con tu nombre de usuario. El trigger crea el perfil en la transacción del registro, antes de confirmar el correo. No lo insertes a mano si falta: hay que revisar por qué no se ejecutó el flujo esperado.

Las pruebas locales verifican ese trigger, la unicidad sin distinguir mayúsculas y la reversión del alta ante un perfil inválido. **La fila de tu usuario real solo puede comprobarse después de que tú completes el registro.** No se ha creado ninguna cuenta ni consultado un perfil privado desde Codex.

## Inicio, persistencia y cierre de sesión

1. Desde «Elige tu club», pulsa «Cerrar sesión». Debes volver a la bienvenida. Abrir una ruta protegida como `/clubs` debe llevarte al login.
2. Inicia sesión con el correo confirmado y tu contraseña. Debes ver tus clubes reales o el estado vacío. No necesitas crear un club para probar Auth.
3. Recarga Chrome y cierra/reabre la pestaña en el mismo perfil. La sesión debe persistir; entra mediante «Iniciar sesión» para volver a la selección si estás en la bienvenida.
4. Cierra sesión otra vez y recarga. La sesión debe seguir cerrada. No desactives RLS ni crees filas manuales para solucionar un fallo.

No se ejecutan de nuevo las migraciones. No se han creado usuarios, clubes o datos remotos durante las pruebas automáticas. El registro, correo, perfil real y login/logout deben marcarse como probados únicamente después de este recorrido manual.
