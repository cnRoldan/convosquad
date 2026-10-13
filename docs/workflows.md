# Fase 3: configuración y prueba completa

## Qué funciona y qué se ha validado

Las pantallas de acceso, clubes, solicitudes, invitaciones y plantilla llaman a Supabase con la sesión del usuario. Sin backend configurado indican el requisito y no muestran un guardado o un envío de correo ficticio. La demo conserva navegación y datos simulados; permite analizar/corregir texto, pero no guardar ni aceptar invitaciones.

Validación local: TypeScript estricto, ESLint, 12 pruebas unitarias del parser/enlaces, 34 pruebas SQL con PostgreSQL/PGlite, tipos generados y bundles de iOS, Android y web. Los tests SQL ejecutan permisos y transacciones reales con un fixture de Auth: no son una prueba de Supabase Auth, correo, PostgREST HTTP ni concurrencia entre conexiones. La revisión en Chromium comprueba la interfaz web móvil de la demo. No se ha ejecutado una build EAS ni una prueba nativa en un dispositivo.

## Preparar un proyecto real desde la nube

1. Sigue [Datos y seguridad](database.md): aplica las cuatro migraciones en orden a un proyecto de desarrollo. Si ya tienes la fase 2 aplicada, añade únicamente `20261013190000_club_workflows.sql`. No ejecutes el fixture de los tests en ese proyecto.
2. Configura Email/Password, confirmación de correo, contraseña mínima de ocho caracteres y SMTP. En la plantilla **Reset Password** de Supabase utiliza `supabase/templates/recovery.html`, que incluye `{{ .ConfirmationURL }}` y `{{ .Token }}`. El código es una alternativa segura cuando el enlace se abre en otro cliente sin el verificador PKCE. Los ajustes de `supabase/config.toml` solo configuran un stack local; no actualizan el proyecto alojado.
3. Define en el entorno de Codex o en un `.env` ignorado la URL Supabase y su clave publicable. Nunca uses una clave secreta o `service_role` en variables `EXPO_PUBLIC_*`.
4. Autoriza el callback en Supabase. Las builds móviles propias usan `convosquad://auth/callback`; web necesita su URL HTTPS real de `/auth/callback`. `EXPO_PUBLIC_AUTH_REDIRECT_URL` permite fijar el callback correspondiente al cliente de prueba. Para Expo Go usa el enlace `exp://…/--/auth/callback` que corresponda al túnel actual: el esquema propio requiere una build de desarrollo o preview instalada.
5. Para compartir invitaciones HTTPS en WhatsApp, despliega la exportación web `dist` y define `EXPO_PUBLIC_INVITE_BASE_URL` con su origen HTTPS, sin rutas, consultas ni credenciales. El alojamiento debe servir las rutas de Expo Router, incluido `/invite`, `/auth/callback` y las rutas dinámicas de jugadores con su fallback. Autoriza el callback de ese dominio y reinicia Metro o recompila tras cambiar variables.

La clave publicable se incluye en el bundle; la seguridad depende de RLS y de las comprobaciones RPC. Si la salida de red está restringida, permite el hostname exacto de tu proyecto Supabase. Las credenciales de CLI, SMTP o Expo se configuran por el mecanismo seguro del servicio correspondiente y nunca se versionan.

## Recorrido con dos cuentas reales

Usa dos correos tuyos accesibles, A y B, y nombres de usuario distintos.

1. **Acceso:** registra A, confirma el correo en el cliente donde comenzó el alta y entra. Comprueba los errores de usuario repetido con distinta capitalización y contraseña incorrecta. Recarga/reabre para verificar persistencia; cierra sesión y comprueba que las rutas protegidas vuelvan al login.
2. **Club:** A crea un club con nombre, descripción y `Europe/Madrid`, activando su búsqueda pública. Verifica la confirmación, selección y rol administrador. Crea un segundo club y cambia entre ellos; las plantillas y permisos deben mantenerse separados. Tras el login, una sola pertenencia permite entrar directamente; «Cambiar de club» conserva las opciones de buscar o crear.
3. **Solicitud:** B se registra, busca el club público y solicita unirse. Comprueba su estado pendiente y el bloqueo de duplicados. A abre «Solicitudes pendientes» y aprueba; B actualiza «Mis solicitudes» y entra como jugador. Prueba también una solicitud rechazada con otro club. Los clubes privados no aparecen en búsqueda.
4. **Ficha sin registrar:** A añade `AlexR10`, dorsal `10`, posición `MCO`. Comprueba «Sin registrar», orden por dorsal y filtros. B solo debe poder leer: no debe tener botones de edición/importación ni acceder a sus rutas de administración.
5. **Vinculación:** A edita la ficha existente, selecciona B entre los miembros activos y confirma la vinculación. Guarda antes cualquier cambio pendiente. Comprueba que sigue siendo la misma ficha, conserva dorsal/EA ID/posición y cambia a «Registrado». B no puede reclamar fichas; tampoco puede vincularse una cuenta ajena al club ni una cuenta que ya tenga ficha allí.
6. **Edición e inactividad:** A cambia los campos y desactiva la ficha con confirmación. No debe aparecer en la plantilla activa; A puede verla mediante «Mostrar inactivos» y reactivarla. No hay borrado desde esta interfaz. Los snapshots de convocatorias existentes conservan sus datos históricos.
7. **Importación:** A pega el ejemplo inferior, analiza y revisa todas las filas. Introduce una línea malformada, corrígela o desmárcala explícitamente; prueba un EA ID ya existente y otro repetido con distinta capitalización. Los errores bloquean la importación; dorsales repetidos son advertencias. Confirma el lote y comprueba el número realmente devuelto por el backend. No se reemplaza ninguna ficha previa; un error revierte el lote entero.
8. **Invitación:** A genera un enlace con caducidad y número de incorporaciones, lo comparte desde el menú del dispositivo o WhatsApp y verifica sus metadatos. Prueba el enlace sin sesión: debe conservar la invitación durante login/registro y pedir aceptación explícita. Un miembro nuevo consume un uso y entra como jugador. Para probar consumo necesitas una cuenta que aún no pertenezca al club; los miembros actuales pueden abrir su propio club. Prueba revocación, agotamiento y caducidad. Para caducidad, espera el plazo mínimo de una hora en desarrollo o crea un token de duración breve mediante la RPC existente en un cliente de prueba autenticado como admin; no cambies el reloj del teléfono ni alteres tablas de producción.
9. **Recuperación:** pide recuperación para A, abre el correo y usa el enlace en el mismo cliente o introduce el código en «Tengo un código de recuperación». Cambia la contraseña, verifica el cierre de sesión y entra con la nueva. Una sesión normal o un enlace inventado no permiten abrir el formulario protegido de cambio.

```text
1 - Portero (POR)
3 - Luis (DFC)
5 - Sergio (DFC)
6 - Dani (LI)
8 - Javi (MCD)
10 - Mario (MCO)
11 - Carlos (DC)
```

## Enlaces y pruebas móviles sin tiendas

Consulta los comandos EAS y del túnel en el [README](../README.md). Puedes instalar una build `development` o un APK `preview` sin publicar en las tiendas. Con Expo Go y un túnel activo, el enlace generado usa el origen de desarrollo que devuelve Expo Linking; ambos teléfonos deben poder acceder a ese túnel. Con una build propia usa el esquema `convosquad://invite`. Puedes pegar un enlace de desarrollo en el navegador del teléfono o abrirlo desde un mensaje; WhatsApp puede no reconocer como clicables los esquemas personalizados, por eso la opción HTTPS es la adecuada para compartir con el equipo.

Los enlaces HTTPS abren la versión web; no se afirma que abran automáticamente la app nativa mediante Universal Links/App Links. Esa asociación de dominio queda pendiente. El token HTTPS está en el fragmento y no se envía al servidor de alojamiento. Es una credencial de incorporación: compártela solo con los destinatarios previstos. La app no la almacena en disco ni permite recuperar el token a partir de los metadatos. Si se cierra el proceso durante registro o se confirma desde otro dispositivo, vuelve a abrir el enlace original tras autenticarte.

## Pendientes

Validar este recorrido con Supabase alojado, SMTP y PostgREST, y en dispositivos Android/iOS; configurar el proyecto EAS y el dominio HTTPS reales. Las convocatorias siguen siendo de solo lectura en la interfaz. Realtime, push, gestión de asistencia e históricos en pantallas no se implementan en esta fase. No hay pagos. No se han aplicado migraciones a un proyecto remoto ni publicado una app.
