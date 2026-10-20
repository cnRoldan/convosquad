# Solicitudes de incorporación

Las solicitudes nuevas preparan un aviso push para todos los capitanes activos del club con dispositivos registrados. El mensaje usa el ID de EA del solicitante, el nombre real del club y el idioma del destinatario. No depende de las preferencias de avisos de votos ni exige una ficha o convocatoria. No se generan avisos retroactivos para solicitudes existentes.

Antes del envío se vuelven a comprobar el estado pendiente, el rol de capitán, la pertenencia activa y la validez del dispositivo. Una solicitud ya aprobada/rechazada o un capitán degradado quedan excluidos. Cada solicitud genera un único evento, con entregas idempotentes por dispositivo. El worker existente `send-reminders` procesa la cola cada minuto; la entrega de Expo/APNs/FCM sigue dependiendo del sistema operativo y del permiso del destinatario.

El chip de «Mis solicitudes» cuenta únicamente las solicitudes recibidas pendientes de los clubes donde el usuario es capitán. Las solicitudes que el propio usuario ha enviado se muestran aparte y no incrementan el chip. «Mis solicitudes» permite aprobar o rechazar sin cambiar de club; la pantalla de gestión del club muestra la misma fuente de datos filtrada por club.

La suscripción Realtime utiliza las políticas RLS existentes de `join_requests`: solo solicitante y capitanes activos pueden leer esos registros. Se recargan los datos autorizados en vez de confiar en los datos del evento. La lista y el contador se actualizan al recibir INSERT/UPDATE, al reconectar y al volver al primer plano. La consulta periódica cada 30 segundos y la actualización manual/al deslizar permiten recuperar cambios perdidos, incluidos borrados por cascada. Cambiar de cuenta o de permisos invalida la caché correspondiente.

Al tocar el push se valida la cuenta destinataria, se recargan los clubes y se comprueba que el usuario conserva el rol de capitán antes de abrir las solicitudes de ese club. No hay acciones de voto ni aprobación automática desde el aviso.

Despliegue: actualizar primero `send-reminders` con el módulo compartido y el dashboard regenerado; aplicar después `20261020000300_join_request_notifications.sql`. La migración amplía los tipos y ámbitos de eventos e incorpora `join_requests` y `club_members` a la publicación Realtime sin ampliar sus políticas RLS. No requiere nuevas variables de entorno ni dependencias móviles. El contador y la navegación del aviso requieren una nueva build móvil; no se ha lanzado ninguna build de EAS.
