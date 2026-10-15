# Capitanes y avisos

## Administración del club

**Inicio → Capitanes** es accesible solo a capitanes. Se reutiliza el rol interno `admin`, que ya permite gestionar plantilla, solicitudes, invitaciones, convocatorias e historial. No existe un límite de capitanes. Se puede nombrar a un miembro activo que tenga cuenta y una ficha activa vinculada. Una ficha sin cuenta o inactiva no es elegible. El creador es el primer capitán y no necesita crear una ficha para administrar.

Cualquier capitán puede nombrar o retirar la capitanía de otro jugador. El creador conserva su rol y membresía activa; no se le puede retirar por ese RPC. Solo el creador ve **Eliminar club**, con confirmación explícita. El RPC `delete_club` comprueba también el UUID del creador y los permisos en servidor: ocultar el botón no es la medida de seguridad. El borrado explícito elimina el club, plantilla y convocatorias de ese club mediante las cascadas existentes, pero no cuentas Auth. La migración nunca ejecuta un borrado de datos de usuario.

## Configurar avisos

Los avisos se configuran por convocatoria, ya no desde Capitanes. Al crearla, **Último aviso para votar** propone **18:45**, en el mismo día y zona horaria del club. Puede editarse junto a fecha y hora desde la convocatoria, o desactivarse. Debe ser anterior al inicio. Si al crearla el aviso ya ha pasado pero la convocatoria todavía no ha comenzado, se prepara en la próxima ejecución del worker.

Este último aviso llega únicamente a jugadores registrados que sigan sin responder y con membresía y dispositivos activos. PRUEBAS y AYUDAS no son destinatarios. La migración conserva los avisos futuros anteriores cuando caen dentro del mismo día de la convocatoria; los avisos antiguos de otro día quedan sin programar y deben revisarse. La columna antigua `clubs.reminder_minutes` permanece para conservar datos y compatibilidad de esquema, pero ya no programa envíos.

Cada cambio efectivo de disponibilidad crea un evento transaccional para los demás jugadores registrados de esa convocatoria, con su ID de EA y respuesta. El autor no recibe su propio aviso en ninguno de sus dispositivos. En **Mis clubes → Notificaciones → Avisarme cuando otro jugador vote**, cada usuario puede desactivar estos avisos; está activado por defecto y se aplica a todos sus clubes y dispositivos. Desactivar estos avisos no desactiva el último aviso para votar. Se revalida la preferencia y el acceso antes de reservar cada entrega.

Solo se permite cambiar el voto cada **30 segundos**, contados desde el último cambio aceptado por el servidor. Pulsar la misma opción no crea eventos ni reinicia el contador. La app muestra el tiempo restante y desactiva los botones; el RPC aplica el límite también ante varias sesiones y acciones push.

## Responder desde una notificación

Las nuevas notificaciones incluyen **Disponible**, **No disponible** y **Backup**. En Android puede ser necesario expandir el aviso; en iOS, mantenerlo pulsado. Las acciones requieren desbloquear y abren la app para usar la sesión de Supabase con seguridad: no se envía el JWT en el aviso ni se da acceso anónimo al voto. Si falta sesión, se conserva la acción durante el login. Se comprueba que la cuenta coincide con el destinatario, que pertenece al club y tiene ficha en esa convocatoria; el RPC comprueba apertura, acceso, autoría y cooldown. Una acción repetida no vuelve a cambiar una respuesta posterior ni genera otro evento.

La app confirma el resultado o muestra el error. Si falla la red, se puede abrir la convocatoria para consultar el estado real antes de volver a responder. No se implementa un servicio de ejecución de acciones en segundo plano. Las notificaciones emitidas antes de actualizar el worker no tendrán las acciones ni el destinatario necesario.

## Activación del backend (pendiente, no automática)

1. En Supabase SQL Editor aplica una sola vez `supabase/migrations/20261015200000_captains_reminders.sql`, después de las migraciones anteriores. Aplica también `20261015210000_refresh_call_up_roster.sql` si falta y, por último, **`20261015220000_call_up_notifications.sql`**. No repitas el setup inicial ni la migración de ID de EA si ya está aplicada.
2. Despliega la función `send-reminders` y sus módulos `_shared` desde este repositorio. Actualiza el worker aunque ya estuviera desplegado: ahora procesa también los eventos de voto. Se puede hacer desde Codex Cloud con Supabase CLI (`npx supabase functions deploy send-reminders --project-ref <ref-del-proyecto>`), usando `SUPABASE_ACCESS_TOKEN` en el gestor de secretos. No es la clave publicable de la aplicación. En este trabajo no se ha solicitado ni usado una credencial administrativa de Supabase.
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

El worker exige su secreto y solo acepta POST. Descubre convocatorias con último aviso vencido mediante un RPC exclusivo de `service_role`; un usuario no aporta tokens, destinatarios ni mensajes arbitrarios. La cola existente conserva RLS sin acceso de clientes a tokens ajenos. Cada ejecución prepara hasta 100 convocatorias y procesa hasta 10 eventos de la cola, incluyendo votos, con lotes de hasta 100 dispositivos. Si hay más trabajo, queda para la siguiente ejecución.

El último aviso es idempotente por convocatoria e instante del aviso; cada voto lleva una revisión incremental. Cambiar la hora de la convocatoria o del aviso puede crear un nuevo evento; se descartan entregas pendientes del ajuste anterior. Desactivar avisos, cancelar/cerrar la convocatoria, retirar acceso o cambiar un token invalida entregas antes de reservarlas. Las reservas atómicas impiden que dos workers envíen la misma entrega. Las entregas ya reservadas o aceptadas por Expo no pueden retirarse.

Un resultado `sent` guarda un ticket **aceptado por Expo**, no una confirmación de entrega al móvil. Las respuestas de red ambiguas se marcan `unknown` y no se reintentan automáticamente, para evitar duplicados. Si el worker se interrumpe tras reservar una entrega, esta puede quedar `processing`; se necesita conciliación manual de ese caso. La consulta periódica de receipts de Expo y los reintentos con conciliación quedan pendientes. Tampoco se reactivan automáticamente eventos previamente descartados al volver a activar la misma configuración.

No se ha ejecutado ninguna migración remota, desplegado el worker, creado cron ni enviado notificaciones reales en esta tarea. Los tests interceptan todas las llamadas de envío o usan PostgreSQL local.

## Agrupar cambios antes de EAS

Netlify puede publicar una vista previa web de la PR sin consumir una build Android. Acumula cambios, completa las pruebas web y aplica el backend antes de solicitar una nueva APK. No hay un workflow nuevo que lance EAS automáticamente. La build previa conserva el código que tenía cuando se subió; no recibe estos cambios por publicar la web.

## Prueba antes de una nueva APK

1. Aplica manualmente la migración incremental y actualiza `send-reminders`, sin repetir las iniciales. Activa un único cron como se indica arriba si aún no existe. Con un cron por minuto los avisos de votos pueden tardar hasta el siguiente ciclo, además del tiempo de entrega de Expo; no son un canal instantáneo garantizado.
2. En la vista previa de Netlify crea una convocatoria y comprueba las 18:45 por defecto, una hora inválida, desactivación y edición del aviso. Prueba un voto y la cuenta atrás con dos sesiones autorizadas. La web no recibe push nativo.
3. Tras agrupar y fusionar los cambios, solicita una nueva APK preview; la APK que ya estaba en cola no se actualiza sola. Instálala en dos dispositivos físicos con cuentas diferentes, activa sus notificaciones y vincula sus fichas antes de crear la convocatoria.
4. Verifica avisos de otros votos, exclusión del autor y opt-out, los tres botones de la notificación, el límite de 30 s, sesión cerrada, club sin acceso y convocatoria cerrada. Comprueba que el último aviso excluye a quien ya respondió.

La entrega y las acciones nativas no se han probado todavía en dos dispositivos reales. Receipts y conciliación de entregas ambiguas continúan pendientes.
