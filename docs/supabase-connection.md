# Conectar el proyecto Supabase real

El propietario indica que las cuatro migraciones están aplicadas y las nueve tablas tienen RLS. No vuelvas a ejecutar `supabase/setup/initial-setup.sql` ni las migraciones iniciales. Esta configuración no aplica SQL remoto.

## Variables en Codex Cloud

Abre los ajustes del entorno de esta tarea y su gestor de variables de entorno. Revisa los requisitos guardados y establece:

| Variable | Valor |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://cirdgzlecufhcgkszbvt.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | La clave **Publishable** moderna del proyecto, con prefijo `sb_publishable_` |

Copia la clave desde los ajustes de API Keys de Supabase. Es una variable pública que Expo incorpora al bundle; no debe ser una clave secreta `sb_secret_`, `service_role`, contraseña ni la clave JWT `anon` heredada. Introduce su valor en el gestor del entorno, no en el chat, los comandos ni el repositorio. Para Expo debe estar disponible como valor de variable de proceso al generar el bundle; un placeholder de un secreto sustituido solo por un proxy HTTP no sirve para distribuir la app.

Guarda los ajustes. Si el gestor requiere publicar el entorno, publícalo y abre una nueva tarea/instancia con esa configuración. Guardar el borrador desde Codex no inyecta valores automáticamente en procesos ya iniciados. Comprueba presencia sin imprimir valores:

```sh
node -e "for (const name of ['EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) console.log(name + ': ' + (process.env[name] ? 'presente' : 'ausente'))"
```

Permite `cirdgzlecufhcgkszbvt.supabase.co` en la salida de red del entorno. Reinicia Metro con `npm start -- --clear` o el comando de web/túnel que estés utilizando. Expo requiere accesos estáticos a `process.env.EXPO_PUBLIC_*`; los mantiene `src/lib/supabase.ts`. No se necesita un `.env` con valores reales en Git. `.env.example` solo contiene nombres y campos vacíos.

## Cliente y datos reales

El SDK instalado admite claves publicables modernas. El cliente valida el origen y el tipo de clave, conserva la sesión en AsyncStorage en React Native y usa `processLock` para serializar operaciones de Auth. Mantiene PKCE, renovación de tokens y pausa/reanudación de la renovación según AppState. En web conserva el almacenamiento y bloqueo predeterminados del SDK. No construyas manualmente un JWT o un encabezado Bearer a partir de la clave publicable: el SDK gestiona API key y token de sesión.

Los servicios de Auth, perfiles, clubes, miembros, jugadores, solicitudes, invitaciones y convocatorias utilizan el cliente real y los tipos derivados de las cuatro migraciones. Las llamadas RPC y sus parámetros se comprueban con TypeScript y las pruebas SQL locales. Los datos simulados se usan exclusivamente tras elegir «Explorar la demo»; un fallo de red o una plantilla vacía de un usuario real no se sustituyen por fixtures. La demo no guarda cambios ni canjea invitaciones.

## Diagnóstico de lectura

Una vez disponibles las dos variables en el proceso:

```sh
npm run supabase:check
```

Ejecuta únicamente un GET del directorio público con límite cero y un HEAD de la RPC de lectura `search_clubs`. No crea cuentas, sesiones, clubes o fichas; no ejecuta SQL, migraciones ni RPC de escritura. No imprime claves, sesiones ni filas. El código de salida es 0 si ambas lecturas pasan, 2 si falta configuración o es inválida y 1 ante un error HTTP/de red.

Este diagnóstico valida conectividad, clave y exposición de esos recursos públicos. No demuestra permisos de cuentas autenticadas ni las demás RPC remotas. Las RPC de escritura no se prueban sobre el proyecto sin un recorrido explícito con cuentas reales. `npm run test` y `npm run db:types:check` utilizan exclusivamente PostgreSQL/PGlite local, no Supabase remoto.

## Auth, correo y callbacks

En Supabase Dashboard:

1. Activa Email/Password, confirma la política de verificación de correo y una longitud mínima de contraseña de ocho caracteres. El registro requiere correo real y `username` único; el trigger de las migraciones crea el perfil sin roles procedentes de metadatos.
2. Configura SMTP propio para enviar confirmación y recuperación a los usuarios previstos. Revisa los límites de envío. En **Reset Password** utiliza `supabase/templates/recovery.html` para incluir tanto `{{ .ConfirmationURL }}` como `{{ .Token }}`. El código OTP permite recuperación cuando no está disponible el verificador PKCE del cliente original.
3. En URL Configuration establece la Site URL real de tu web si existe, y autoriza las Redirect URLs de los clientes utilizados:
   - Build propia instalada: `convosquad://auth/callback`.
   - Expo Go: el enlace `exp://…/--/auth/callback` correspondiente al túnel actual. Expo Linking lo genera; cambia cuando cambia el túnel y hay que autorizarlo de nuevo.
   - Web: la dirección HTTPS desplegada de `/auth/callback`.
4. `EXPO_PUBLIC_AUTH_REDIRECT_URL` es opcional: permite fijar una URL autorizada para ese cliente. Déjala vacía para usar Expo Linking. No reutilices un callback web fijo en una build móvil que deba recibir el enlace, ni el localhost de Codex para abrirlo desde el teléfono. La confirmación PKCE debe volver al cliente que inició el registro; si termina en otro cliente, vuelve a iniciar sesión una vez confirmado el correo.

La key del proyecto no configura Auth ni SMTP. Los ajustes de `supabase/config.toml` tampoco actualizan el proyecto alojado.

Para compartir invitaciones web por WhatsApp, configura `EXPO_PUBLIC_INVITE_BASE_URL` con un origen HTTPS desplegado. Para builds EAS, define las mismas variables públicas en el entorno Expo correspondiente a la build; las variables del entorno Codex no se copian automáticamente al servicio EAS. Recompila si cambian: son valores incorporados al bundle. EAS requiere vincular un proyecto Expo real.

## Recorrido posterior

Sigue [la prueba con dos cuentas](workflows.md): registro/verificación/login, persistencia tras cerrar/reabrir, recuperación, creación y selección de clubes, solicitudes/aprobación, invitaciones y administración de plantilla. Verifica que una cuenta jugador no gestione fichas y que los clubes privados permanezcan aislados. No se han enviado correos ni realizado escrituras remotas durante esta preparación. Las pruebas nativas, SMTP y los flujos autenticados alojados quedan pendientes hasta completar la configuración y probarlos.
