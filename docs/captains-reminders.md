# Capitanes y avisos

## Administración del club

**Inicio → Capitanes y avisos** es accesible solo a capitanes. Se reutiliza el rol interno `admin`, que ya permite gestionar plantilla, solicitudes, invitaciones, convocatorias e historial. No existe un límite de capitanes. Se puede nombrar a un miembro activo que tenga cuenta y una ficha activa vinculada. Una ficha sin cuenta o inactiva no es elegible. El creador es el primer capitán y no necesita crear una ficha para administrar.

Cualquier capitán puede nombrar o retirar la capitanía de otro jugador. El creador conserva su rol y membresía activa; no se le puede retirar por ese RPC. Solo el creador ve **Eliminar club**, con confirmación explícita. El RPC `delete_club` comprueba también el UUID del creador y los permisos en servidor: ocultar el botón no es la medida de seguridad. El borrado explícito elimina el club, plantilla y convocatorias de ese club mediante las cascadas existentes, pero no cuentas Auth. La migración nunca ejecuta un borrado de datos de usuario.

## Configurar avisos

Cada club tiene su ajuste independiente, desactivado inicialmente. Activa **Notificar a los jugadores antes de la convocatoria**, elige la antelación del desplegable (15 min, 30 min, 1 h, 2 h o 1 día) y pulsa **Guardar avisos**. Los capitanes tienen los mismos permisos de edición. Los jugadores no pueden guardar ajustes por la API ni ejecutar operaciones de envío.

Los destinatarios son las cuentas de la fotografía de jugadores de la convocatoria que mantengan membresía activa y dispositivos registrados con notificaciones activadas. Se incluyen quienes ya hayan respondido; PRUEBAS y AYUDAS no son destinatarios. Se admite más de un dispositivo por cuenta. La referencia es `starts_at`, almacenada como instante UTC; por eso se respeta la zona horaria del club sin depender del teléfono o del huso horario del cron.

## Activación del backend (pendiente, no automática)

1. En Supabase SQL Editor aplica una sola vez `supabase/migrations/20261015200000_captains_reminders.sql`, después de las migraciones anteriores. No repitas el setup inicial ni la migración de ID de EA si ya está aplicada.
2. Despliega la función `send-reminders` y sus módulos `_shared` desde este repositorio. Se puede hacer desde Codex Cloud con Supabase CLI (`npx supabase functions deploy send-reminders --project-ref <ref-del-proyecto>`), usando `SUPABASE_ACCESS_TOKEN` en el gestor de secretos. No es la clave publicable de la aplicación. En este trabajo no se ha solicitado ni usado una credencial administrativa de Supabase.
3. En los secretos de Edge Functions configura `PUSH_WORKER_SECRET` con un valor aleatorio de al menos 32 caracteres; no lo incluyas en la aplicación ni GitHub. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son variables de servidor provistas por Supabase. Si Expo tiene activada la seguridad adicional para push, configura también `EXPO_ACCESS_TOKEN` únicamente en el servidor.
4. Habilita Cron y pg_net desde el panel de Supabase. Guarda en Vault `convosquad_supabase_url` (origen del proyecto) y `convosquad_reminder_worker_secret` (el mismo secreto del worker). Programa un job por minuto con el SQL de abajo. El cron solo llama al endpoint del worker; no distribuye `service_role` a clientes.
5. Prueba con una convocatoria y una cuenta autorizadas en un dispositivo físico, tras habilitar sus notificaciones en ConvoSquad. Verifica la recepción y que pulsar el aviso abre esa convocatoria. Compilar web o recibir un ticket de Expo no valida la entrega física.

El job siguiente solo debe crearse cuando se quiera **activar los envíos reales**. No se incluye en la migración y no se ha ejecutado:

```sql
select cron.schedule('convosquad-reminders', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'convosquad_supabase_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                    where name = 'convosquad_reminder_worker_secret')
    ),
    body := '{}'::jsonb
  );
$job$);
```

## Seguridad y límites del envío

El worker exige su secreto y solo acepta POST. Descubre convocatorias vencidas para recordatorio mediante un RPC exclusivo de `service_role`; un usuario no aporta tokens, destinatarios ni mensajes arbitrarios. La cola existente conserva RLS sin acceso de clientes a tokens ajenos. Cada ejecución prepara hasta 100 convocatorias y procesa hasta 10 eventos, con lotes de hasta 100 dispositivos. Si hay más trabajo, queda para la siguiente ejecución.

El evento es idempotente para la combinación club, convocatoria, hora y antelación. Cambiar hora o antelación puede crear un nuevo evento; se descartan entregas pendientes del ajuste anterior. Desactivar avisos, cancelar/cerrar la convocatoria, retirar acceso o cambiar un token invalida entregas antes de reservarlas. Las reservas atómicas impiden que dos workers envíen la misma entrega. Las entregas ya reservadas o aceptadas por Expo no pueden retirarse.

Un resultado `sent` guarda un ticket **aceptado por Expo**, no una confirmación de entrega al móvil. Las respuestas de red ambiguas se marcan `unknown` y no se reintentan automáticamente, para evitar duplicados. Si el worker se interrumpe tras reservar una entrega, esta puede quedar `processing`; se necesita conciliación manual de ese caso. La consulta periódica de receipts de Expo y los reintentos con conciliación quedan pendientes. Tampoco se reactivan automáticamente eventos previamente descartados al volver a activar la misma configuración.

No se ha ejecutado ninguna migración remota, desplegado el worker, creado cron ni enviado notificaciones reales en esta tarea. Los tests interceptan todas las llamadas de envío o usan PostgreSQL local.

## Agrupar cambios antes de EAS

Netlify puede publicar una vista previa web de la PR sin consumir una build Android. Acumula cambios, completa las pruebas web y aplica el backend antes de solicitar una nueva APK. No hay un workflow nuevo que lance EAS automáticamente. La build previa conserva el código que tenía cuando se subió; no recibe estos cambios por publicar la web.
