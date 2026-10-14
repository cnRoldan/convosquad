# ConvoSquad

Aplicación móvil para gestionar las convocatorias de equipos de EA Sports FC, modalidad Clubes Pro. Base inicial para iOS y Android, desarrollada con Expo SDK 57, React Native, Expo Router y TypeScript estricto.

## Estado de esta versión

La demo funciona sin Supabase ni credenciales. Incluye bienvenida, formularios de login y registro, selección de club y pestañas de inicio, plantilla y convocatoria. Álex pertenece a dos clubes: es administrador en Squad Verde FC y jugador en Norte United. Al cambiar de club se muestran su plantilla y convocatoria independientes.

La fase 3 añade recuperación de contraseña, selección persistente de club, búsqueda pública, solicitudes y aprobación, invitaciones caducables/revocables compartibles por WhatsApp y administración de plantilla. Permite crear, editar, desactivar y vincular una ficha sin registrar a una cuenta existente, además de importar plantillas con vista previa editable y confirmación. Las operaciones reales requieren Supabase configurado; la demo es de solo lectura y nunca simula guardados exitosos. El acceso utiliza correo real y nombre de usuario único, según la decisión aprobada.

Las migraciones, RLS, servicios y pruebas están documentados en [Datos y seguridad](docs/database.md). **No se ejecutan migraciones remotas automáticamente. Si ya las aplicaste, no las repitas.** Las convocatorias siguen siendo de solo lectura en la interfaz. No hay pagos ni suscripciones.

## Trabajar exclusivamente desde Codex Cloud

No necesitas instalar Node, Android Studio ni Xcode en Windows. Ejecuta estos comandos en el checkout de Codex Cloud:

```sh
cd /workspace/convosquad
# Node 24.19.0; también se admite Node 22.13+ o 24.3+ dentro de esas versiones mayores.
export npm_config_cache=/tmp/convosquad-npm-cache
export EXPO_NO_TELEMETRY=1
npm ci
npm run check
npm run test
npm run db:types:check
npm run export
```

`package-lock.json` fija las dependencias. No uses `npm audit fix --force`: las dependencias nativas deben seguir siendo compatibles con el SDK. Para añadir módulos Expo, usa `npx expo install <paquete>`; si la API de Expo está bloqueada, `EXPO_OFFLINE=1 npx expo install <paquete>` usa la tabla de compatibilidad del SDK instalado.

## Probar la aplicación desde la nube

Para la primera cuenta real desde Chrome en Windows, sin instalaciones locales, sigue [Primera prueba de Auth en web](docs/first-web-auth-test.md). Incluye el despliegue desde GitHub en Netlify y cómo obtener el callback HTTPS exacto. No hay una URL pública de pruebas publicada automáticamente.

### APK de Android con EAS (opción recomendada)

EAS compila en la nube; el APK se instala en un teléfono Android sin herramientas locales. Hace falta una cuenta Expo y vincular este checkout a tu proyecto:

```sh
npm run eas -- login
npm run eas -- init
npm run eas -- build --platform android --profile preview
```

También puedes ejecutar EAS en Codex con `EXPO_TOKEN` configurado como secreto mediante los ajustes seguros compatibles con tu entorno; no lo pegues en el chat ni lo guardes en Git. Si el login interactivo no está disponible, usa ese mecanismo de autenticación. `eas init` añade el identificador real del proyecto a `app.json`; no se incluye uno ficticio. Revisa los identificadores `com.convosquad.app` antes de registrar la app.

Si la red está restringida, permite `api.expo.dev` y `expo.dev` en los ajustes del entorno. Los enlaces de descarga o túneles pueden necesitar destinos adicionales indicados por EAS o Expo.

EAS proporciona el enlace de descarga al terminar. Esta configuración aún no ha ejecutado ni firmado una compilación EAS.

### iOS y compilaciones de desarrollo

```sh
npm run eas -- build --platform ios --profile preview
npm run eas -- build --platform android --profile development
npm run eas -- build --platform ios --profile development
```

La distribución interna de iOS requiere una cuenta Apple Developer y registrar los dispositivos con EAS. El perfil `development` incluye `expo-dev-client` y necesita conectarse a Metro; el perfil `preview` contiene el bundle y no depende del servidor. `production` prepara builds para las tiendas; publicar en ellas queda pendiente.

### Desarrollo interactivo en un teléfono

```sh
npm run start:tunnel -- --go
```

Expo puede solicitar instalar `@expo/ngrok` para el túnel. Se necesita acceso de red a los servicios de Expo y del túnel. Escanea el QR con una versión de Expo Go compatible con SDK 57. Si Expo Go no admite ese SDK, utiliza una compilación de desarrollo de EAS:

```sh
npm run start:tunnel -- --dev-client
```

Un teléfono no puede acceder al `localhost` de Codex; necesita un túnel o un mecanismo de exposición proporcionado por tu entorno. No se ha validado un túnel público en este entorno. Las notificaciones push remotas requieren una compilación propia y un dispositivo físico, no Expo Go.

### Comprobación web en Codex

```sh
npm run web -- --port 8081
```

La versión web sirve para comprobar navegación y diseño. Solo será accesible fuera de Codex si el entorno ofrece exposición de puertos. La generación de bundles no equivale a una compilación nativa ni a una prueba en un teléfono.

## Supabase

Para conectar el proyecto ya creado desde Codex Cloud, sigue [Conexión con Supabase real](docs/supabase-connection.md): variables del entorno, clave publicable moderna, Auth, SMTP y callbacks.

Copia `.env.example` a `.env` únicamente si necesitas conectar un proyecto real:

```sh
cp .env.example .env
```

Configura:

- `EXPO_PUBLIC_SUPABASE_URL`: URL del proyecto.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave moderna del cliente con prefijo `sb_publishable_`.

Estas variables se incluyen en el bundle: **nunca uses `service_role`, claves secretas ni contraseñas de base de datos**. `.env` está ignorado por Git. Para EAS, configura las mismas variables públicas en el entorno de compilación de tu proyecto Expo. Reinicia Metro cuando cambien.

`src/lib/supabase.ts` exporta un cliente tipado opcional con PKCE y persistencia de sesión. Sin configuración devuelve `null` y la demo funciona. En una instalación nueva aplica las migraciones una sola vez. Configura Auth y el callback siguiendo [Datos y seguridad](docs/database.md). Un filtro de interfaz no sustituye RLS.

El flujo completo con dos cuentas, correo, enlaces y permisos está descrito en [Pruebas de la fase 3](docs/workflows.md). Para compartir enlaces HTTPS configura también `EXPO_PUBLIC_INVITE_BASE_URL` con el origen web desplegado.

## Arquitectura

```text
src/
  app/                 Rutas y layouts de Expo Router
    (auth)/            Login, registro y recuperación
    (account)/         Crear/buscar clubes y consultar solicitudes
    (manage)/          Plantilla, importación, solicitudes e invitaciones
    invite.tsx         Recepción pública de enlaces de invitación
    (club)/            Inicio, plantilla y convocatoria; exige club seleccionado
    clubs.tsx          Selección de club
    index.tsx          Bienvenida
  components/          Componentes reutilizables de interfaz
  features/
    auth/              Formularios de acceso
    clubs/             Tipos, fixtures y estado del club activo
    players/           Servicios, editor y parser de importación
    invitations/       Enlaces, token temporal y servicios
    join-requests/     Solicitudes y revisión
  hooks/               Recursos asíncronos con ámbito de cuenta/club
  lib/                 Supabase, preparación push y formato de fechas
  types/               Tipos generados desde las migraciones
  theme/               Paleta compartida
```

El rol pertenece a la membresía de un usuario en un club, no al usuario global. Plantillas y convocatorias usan `clubId`; las respuestas usan `membershipId`. El contexto centraliza la selección y separa datos simulados y reales. Una ficha de plantilla es independiente de la cuenta y puede mostrarse como «Sin registrar». La selección se guarda por usuario; al recuperarla se comprueba de nuevo que exista una membresía activa. La sesión real puede persistir, mientras que la entrada en la demo es explícita. No se generan carpetas nativas: Expo las produce mediante sus plugins al compilar.

## Notificaciones

`expo-notifications` está declarado como plugin. `src/lib/notifications.ts` prepara la petición explícita de permisos y obtención de un token Expo, pero no se invoca automáticamente ni guarda o envía tokens. Hace falta un `projectId` EAS real, credenciales APNs/FCM y un dispositivo físico. El registro de tokens por usuario y el servicio de envío quedan pendientes.

## Comandos y validación

| Comando | Objetivo |
| --- | --- |
| `npm start` | Metro |
| `npm run web` | Desarrollo web |
| `npm run typecheck` | TypeScript estricto |
| `npm run lint` | ESLint, sin advertencias |
| `npm run check` | TypeScript y lint |
| `npm run test` | 50 pruebas: 16 unitarias y 34 de PostgreSQL/RLS |
| `npm run test:db` | SQL y permisos sin credenciales |
| `npm run test:unit` | Parser y enlaces de invitación |
| `npm run db:types:check` | Sincronización de SQL y TypeScript |
| `npm run db:types` | Regenerar tipos desde las migraciones |
| `npm run supabase:check` | Lectura pública remota, sin filas ni escrituras; requiere variables |
| `npm run export:web` | Versión web estática para hosting |
| `npm run export` | Bundles iOS, Android y web estática |
| `EXPO_OFFLINE=1 npx expo install --check` | Compatibilidad con la tabla del SDK instalado |
| `npm run eas -- build ...` | Compilación nativa en EAS |

GitHub Actions ejecuta instalación reproducible, TypeScript, lint, pruebas de RLS, sincronización de tipos y exportación de bundles en las pull requests. Aún no hay una suite automatizada de pruebas funcionales nativas.

## Próximos pasos

Validar Auth, recuperación y todos los flujos en un proyecto Supabase real; implementar la interfaz de convocatorias y asistencia; integrar Realtime y notificaciones; elegir iconos y recursos gráficos definitivos; vincular EAS y comprobar la app en dispositivos iOS y Android.
