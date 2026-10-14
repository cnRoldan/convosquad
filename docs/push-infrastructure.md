# Fase 5A — Infraestructura push

## Preparado y pendiente

El registro seguro de dispositivos, permisos contextuales, rotación de Expo Push Tokens, navegación protegida y outbox de servidor están implementados. No se solicita permiso al iniciar sesión: abre **Elige tu club → Notificaciones → Activar notificaciones en este dispositivo**. Cada instalación conserva un UUID aleatorio propio; una cuenta admite varias instalaciones. El token se obtiene con el UUID real del proyecto EAS. Web, simuladores y Expo Go no intentan obtener tokens.

La app guarda únicamente el ID de instalación y la preferencia local; los tokens se registran en Supabase. Un rechazo de permiso desactiva el registro existente. Volver a primer plano revalida permisos y token si el usuario ya lo había activado. El listener de cambio del token nativo vuelve a obtener el **Expo Push Token**: nunca guarda directamente un token FCM/APNs como si fuera de Expo. iOS admite permiso provisional; Android crea primero el canal `call-ups`.

Cerrar sesión desde la app nativa detiene registros pendientes, espera las escrituras en curso y limpia token/propietario de esa instalación antes de cerrar Auth. No desactiva otros dispositivos. Si falla la limpieza, la sesión permanece abierta y debe reintentarse con conexión. Una invalidación externa de Auth no puede limpiar el registro sin un JWT vigente; no se promete revocación automática de todos los dispositivos desde el servidor en esta fase. Las notificaciones solo contienen un aviso genérico e IDs; el contenido se consulta tras autenticar y verificar RLS.

No hay envíos automáticos, cron, HTTP de envío a Expo, acciones de disponibilidad, publicación en tiendas ni builds iniciadas desde Codex. El projectId EAS público ya está vinculado en app.json: `99946f80-dcdd-4678-9cbc-5264fb6830d4`. EAS `project:info` confirma el proyecto remoto `@convosquad/k1mbowx`; owner y slug coinciden con la configuración resuelta. **No se han probado tokens, FCM/APNs o recepción push en dispositivos físicos.** Exportar bundles o pasar pruebas web no demuestra entrega push.

## Archivos y configuración

- `app.json`: plugin Expo Notifications, canal predeterminado, permiso Android POST_NOTIFICATIONS, esquema `convosquad`, Android package e iOS bundle identifier `com.convosquad.app`.
- `app.config.ts`: projectId público real mediante variable de entorno y archivo Firebase Android mediante ruta de archivo; no introduce IDs/credenciales ficticios.
- `eas.json`: development (development client e instalación interna), preview (APK e instalación interna) y production (build de producción con incremento de versión), cada uno con su entorno EAS. iOS interno requiere dispositivo físico registrado.
- `src/features/notifications`: registro, cola de escrituras protegida frente a logout, lifecycle y destino pendiente. Pantallas `/notifications` y `/notification`.
- Auth solo integra limpieza al salir y continuación del destino push después de login/callback, conservando la prioridad de recuperación de contraseña. No cambia los mecanismos de autenticación.
- `supabase/functions/prepare-push`: función de servidor opcional que prepara un evento y devuelve solo su ID. No envía notificaciones ni se ha desplegado.

## Migración incremental

Aplicar una vez **solo** `supabase/migrations/20261014200000_push_infrastructure.sql`, después de las seis anteriores, desde SQL Editor. Incluye BEGIN/COMMIT. No repetir el script inicial ni las migraciones originales. Confirma primero el estado de tu proyecto: no se ha consultado el registro de migraciones remoto ni ejecutado SQL remoto durante este trabajo.

Añade:

- `push_devices`: ID de instalación, propietario, Expo Push Token, plataforma, fecha de actualización y estado activo. Token único; RLS permite leer solo los dispositivos propios. Las escrituras directas están revocadas; RPC determina el propietario con `auth.uid()`, valida plataforma/token y rechaza IDs/tokens pertenecientes a otro usuario. La desactivación limpia el token; logout también desvincula propietario. Un dispositivo desvinculado puede registrarse al entrar otra cuenta.
- `push_events`: club, convocatoria, tipo (`published`/`pending`) e identificador de evento único dentro del club.
- `push_deliveries`: una entrega por evento/dispositivo, estado, token privado de preparación y campos de reserva/ticket para el futuro worker. RLS está habilitado y los clientes no tienen permisos de lectura/escritura ni políticas que concedan acceso.
- `prepare_call_up_push` y `claim_push_deliveries`: ejecutables solo por `service_role`. La preparación selecciona fichas vinculadas de la fotografía, membresías activas y dispositivos activos del mismo club; `pending` excluye quienes ya respondieron. La misma clave/evento devuelve el mismo ID sin volver a insertar entregas. Las reservas atómicas no devuelven dos veces una entrega y revalidan token, dispositivo, propietario, membresía, convocatoria abierta y respuesta pendiente.

Las claves compuestas impiden asociar un evento a la convocatoria de otro club. Ningún cliente puede proporcionar destinatarios, tokens ajenos o texto arbitrario al backend de preparación.

El worker futuro debe registrar tickets/receipts de Expo, gestionar DeviceNotRegistered, lotes/límites y resultados ambiguos. Las entregas `processing` no se reintentan automáticamente: hay que resolver sus resultados antes de repetirlas. La cola evita duplicados de preparación/reserva; **no promete exactamente una entrega frente a un timeout externo de Expo**. Revalidar inmediatamente antes del despacho sigue siendo obligatorio. Desvincular no puede retirar una notificación que un proveedor ya haya aceptado.

## Variables y credenciales

Configura en **cada entorno de EAS** (development, preview y production), desde Expo Dashboard → proyecto → Environment variables:

| Nombre | Uso |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase, pública |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave moderna `sb_publishable_…`, pública; nunca service_role |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Opcional: el UUID ya está vinculado en app.json; si se define debe coincidir con él, público |
| `GOOGLE_SERVICES_JSON` | Variable **de tipo archivo** con el google-services.json Android de Firebase; el valor durante la build es su ruta |
| `EXPO_PUBLIC_AUTH_REDIRECT_URL` | Opcional: dejar vacía para Linking o usar `convosquad://auth/callback` en builds nativas. No copiar el callback HTTPS de Netlify |

Las variables de Codex no se transfieren automáticamente a EAS. Para ejecutar el CLI desde Codex configura las variables Supabase en su gestor de entorno; el projectId se obtiene de app.json y no necesita otra variable. `EXPO_TOKEN` es un token de acceso de Expo para autenticar el CLI: introducirlo **solo como secreto en Codex**, sin prefijo EXPO_PUBLIC, sin pasarlo en argumentos ni pegarlo en chat. Alternativamente puede usarse una sesión de CLI autenticada existente. Verifica siempre el propietario del proyecto mediante `eas project:info`.

Supabase Edge Functions, cuando se autorice desplegar el backend: `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son variables exclusivas del servidor provistas por Supabase; `PUSH_WORKER_SECRET` debe configurarse como secreto de al menos 32 caracteres en el gestor de secretos de Supabase. La función usa `verify_jwt=false` y valida explícitamente ese secreto: un JWT de usuario no la autoriza. No desplegarla sin esta protección. No guardar esos valores en `.env.example`, Expo, Netlify, Git ni logs. El futuro emisor debería habilitar Enhanced Push Security en Expo y usar un `EXPO_PUSH_ACCESS_TOKEN` exclusivo del servidor; el emisor no se implementa aquí.

## Android: Firebase Cloud Messaging y primera APK desde Codex Cloud

1. Revisa esta PR y aplica la migración incremental en Supabase cuando esté aprobada.
2. El proyecto existente ya está vinculado mediante su UUID público en app.json. No crees otro proyecto ni ejecutes create-expo-app. Configura las variables Supabase en Codex y en el entorno EAS `preview`; si defines EXPO_PUBLIC_EAS_PROJECT_ID debe coincidir con el UUID vinculado. Inicia la sesión CLI mediante `EXPO_TOKEN` seguro o la autenticación existente.
3. En Firebase Console crea/selecciona el proyecto y registra una app Android cuyo package sea exactamente `com.convosquad.app`. Descarga su `google-services.json` y súbelo como variable de archivo `GOOGLE_SERVICES_JSON` a EAS `preview`. Si haces evaluación/prebuild local en Codex, proporciona también su ruta allí, sin versionar el archivo.
4. Habilita FCM HTTP v1. En Firebase → configuración del proyecto → Service accounts crea/obtén la credencial de cuenta de servicio para FCM. Es **privada y distinta de google-services.json**. Súbela a las credenciales Android del proyecto Expo/EAS (Push Notifications / FCM V1), mediante Dashboard o `npm run eas -- credentials --platform android`. Nunca al repositorio ni al bundle de la app.
5. Desde la terminal de Codex Cloud, en el repositorio:

```sh
npm ci
npm run check
npm run eas:preflight
npm run eas -- whoami
npm run eas -- project:info
npm run eas -- build --platform android --profile preview
```

`eas:preflight` no imprime valores y comprueba las variables Supabase y el projectId resuelto; no valida credenciales privadas ni FCM/APNs. Si falta projectId, falla de forma explícita. La build debe recibir GOOGLE_SERVICES_JSON desde EAS y las credenciales de FCM configuradas. El CLI usa la versión fijada por el repositorio, sin instalar herramientas en Windows. Si necesitas development client, sustituye preview por development.

6. EAS compila en la nube. Sigue la URL real que devuelva el CLI, descarga/abre el enlace de instalación desde Chrome en tu teléfono Android y permite instalar esa APK. No se ha creado ni inventado una URL de build en esta tarea.
7. Inicia sesión con tu cuenta real, abre Notificaciones y activa el dispositivo. Android 13+ pide permiso; versiones anteriores utilizan el canal. En Supabase → Table Editor → push_devices confirma su propietario/plataforma/estado. No publiques el token ni lo copies en logs.
8. Prueba denegar permiso, reabrir/volver a primer plano, desactivar y cerrar sesión. Comprueba que token y propietario se limpian al salir y que otro teléfono de la misma cuenta sigue registrado. No envíes push todavía: la prueba de entrega se autoriza y prepara en una fase posterior.

La primera build puede requerir un keystore Android real administrado por EAS; no se generan certificados de prueba ficticios ni se guardan claves en Git. FCM debe estar configurado antes de intentar registrar el token real.

## iOS: Apple y pruebas físicas

- Hace falta una cuenta Apple Developer con permisos sobre el bundle identifier `com.convosquad.app`, equipo/certificados/perfil válidos y un iPhone físico. Las builds internas requieren registrar su UDID y generar el perfil Ad Hoc correspondiente; no basta un simulador.
- Configura una APNs Auth Key real y las credenciales de firma en Expo/EAS (Apple Developer → Keys → APNs, o el gestor de credenciales EAS). No versionar `.p8`, `.p12`, certificados privados ni perfiles. El plugin y EAS administran el entitlement push apropiado; no se fija un entitlement de producción para todas las builds.
- Configura las variables públicas para EAS `preview`. **No se necesita GoogleService-Info.plist** para el flujo iOS APNs → Expo Push Service de esta app.
- Desde Codex, cuando tengas autorización y credenciales: `npm run eas -- device:create`, después `npm run eas -- build --platform ios --profile preview`. Instala mediante el enlace real de EAS desde Safari en el iPhone registrado. Solicita permiso desde Notificaciones y comprueba el registro en Supabase.
- La build production no implica publicación; no se ejecuta `eas submit` ni se publica en tiendas en esta fase.

## Navegación y pruebas

Payload permitido: `data: { type: 'call_up', clubId, callUpId }`. Enlace propio: `convosquad://notification?club=<UUID>&call=<UUID>`. No se sigue un campo URL externo. Se atienden taps normales, arranque frío y app abierta; se deduplican respuestas por identificador. El destino pendiente se conserva en móvil durante login/callback. Recuperación de contraseña tiene prioridad. Se comprueba la sesión, pertenencia al club y lectura de la convocatoria mediante RLS antes de seleccionar el club/navegar. Un club perdido, convocatoria inaccesible/cancelada o fallo de conexión muestra un mensaje en español. Si RLS oculta una cancelada al jugador, el mensaje no expone su contenido.

Pruebas automatizadas: permisos concedidos/rechazados, web excluida, cambios de sesión durante token, escrituras tardías frente a logout, rotación, varios dispositivos, RLS, propietario falso, tokens ajenos, claves de evento, reservas únicas, aislamiento de clubes y revalidación antes de reservar. Navegación: IDs/payload válidos, ausencia de sesión, club ajeno, cancelación; Chromium cubre enlace válido, acceso denegado, continuación hacia login y pantalla web sin registro push. Transporte Supabase de esos tests está simulado/bloqueado, sin acceso remoto.

Verificaciones: `npm run check`, `npm run test`, `npm run db:types:check`, `npm run check:push-server`, `npm run test:ui`, exportaciones Expo. El servidor Deno tiene lockfile y comprobación independiente del TypeScript de Expo. La verificación Deno usa los certificados del sistema, sin desactivar TLS.

Pendiente: vincular EAS/credenciales, aplicar migración, registrar tokens en dispositivos físicos, probar recepción/taps reales iOS/Android y, en fases posteriores, automatizar publicación/recordatorios, envío, receipts y acciones interactivas. No hay datos remotos modificados ni notificaciones enviadas por Codex.

## Vinculación del proyecto existente

El UUID público `99946f80-dcdd-4678-9cbc-5264fb6830d4` está guardado en `expo.extra.eas.projectId` de app.json. app.config.ts lo conserva y rechaza un EXPO_PUBLIC_EAS_PROJECT_ID diferente. El preflight lee la configuración resuelta de Expo, por lo que esa variable es opcional. No se reinicializa la app ni se crea otro proyecto. El perfil preview conserva APK y com.convosquad.app.

Para autenticar EAS desde Codex sin compartir secretos:

1. En tu cuenta Expo, abre Account settings → Access tokens y crea un token con acceso al proyecto existente. Sigue [Programmatic access](https://docs.expo.dev/accounts/programmatic-access/).
2. En la configuración del entorno de Codex Cloud, guarda su valor como **secreto** llamado `EXPO_TOKEN`. No lo añadas a archivos del repositorio ni a variables EXPO_PUBLIC; no lo pegues en chat, argumentos de terminal o logs.
3. Aplica/guarda la configuración y reinicia el entorno o inicia una tarea que reciba ese secreto. Ejecuta `npm run eas -- whoami` y `npm run eas -- project:info` para confirmar el propietario y proyecto antes de cualquier build.

La configuración local conserva `name: ConvoSquad`, Android package/iOS bundle identifier `com.convosquad.app` y el mismo UUID EAS. `owner: convosquad` y `slug: k1mbowx` coinciden con el proyecto remoto verificado mediante `eas project:info`. app.config.ts utiliza el slug de app.json para evitar otra discrepancia. No se ha ejecutado init remoto, build ni submit. El archivo Firebase, las variables de EAS preview y las credenciales Android siguen pendientes antes de autorizar la primera APK.
