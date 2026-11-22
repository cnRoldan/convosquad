# Estado de notificaciones en la plantilla

Solo los capitanes ven una campana junto a los jugadores que pueden tener problemas
para recibir avisos. El diálogo explica el motivo, la última comprobación y los
límites del estado. No hay una confirmación verde de entrega. Un dispositivo
habilitado sin votos silenciados no añade un icono.

El agregado diferencia avisos desactivados en ConvoSquad, permisos bloqueados,
ausencia de dispositivo habilitado, falta de cuenta vinculada, cuenta que ya no
es miembro activo del club y estado desconocido. La preferencia de votos se muestra
como tal: no desactiva todos los avisos ni el recordatorio final para votar.

`report_push_device_status` guarda una observación por usuario e instalación en
una tabla privada. La app móvil informa al registrar un dispositivo, al comprobar
permisos en primer plano o al desactivar los avisos. La observación se hace con la
sesión del propio usuario y la fecha del servidor, sin permitir indicar otro usuario.
El fallo del informe no impide registrar ni desactivar avisos. La salida de sesión
conserva su comportamiento de desactivar/desvincular el dispositivo.

`list_roster_notification_status` comprueba que quien consulta sea capitán activo
del club. Solo devuelve identificador de ficha, estado agregado, fecha y preferencia
de votos; no devuelve tokens, identificadores de instalación ni plataformas. La
consulta no amplía la lectura directa de las tablas de dispositivos o preferencias.

Una comprobación caduca a los siete días. Un solo dispositivo activo con comprobación
reciente habilitada basta para evitar clasificar a una cuenta como bloqueada.
Un dispositivo activo sin comprobación reciente obliga a mostrar desconocido,
aunque otro esté desactivado. Las versiones antiguas que no informan del estado
se muestran como desconocidas; es necesario actualizar la app móvil y abrirla para
recibir estos nuevos informes. No se detecta No molestar, silencio ni lectura real.
La falta de ficha o de membresía no es una prueba de permisos del teléfono.

Se actualizó el texto de privacidad en los cuatro idiomas para explicar este acceso.

Validación: TypeScript y lint; 211 pruebas unitarias existentes; pruebas de base de
datos con migraciones completas para permisos por club/rol, observaciones propias,
varios dispositivos, datos caducados, desvinculación y preferencias; interfaz móvil
para acceso del capitán al motivo y ausencia de indicadores para jugadores.

Las stores instaladas no cambian con el despliegue web: esta función y los informes
nativos deben incluirse en la próxima compilación de iOS y Android. No se ha enviado
una nueva versión a las tiendas como parte de esta implementación.
