# Convocatorias semanales

Un capitán puede activar «Repetir cada semana» al crear una convocatoria y seleccionar
uno o varios días. Los botones usan L M X J V S D en español y las abreviaturas de
Intl para inglés, alemán y francés, con el nombre completo como etiqueta accesible.
El estado seleccionado se comunica a tecnologías de asistencia también en web.

La fecha del formulario es el inicio del período: si no coincide con un día elegido,
la revisión la ajusta al siguiente día seleccionado. La primera convocatoria se crea
al confirmar. Cada club tiene una única programación activa; para cambiarla se puede
detener la anterior y crear otra. La gestión está en Inicio → Administrar el club →
Convocatorias periódicas y también en el formulario de creación.

Las siguientes convocatorias se preparan desde el día anterior (cada minuto se comprueban
las fechas de hoy y mañana en la zona horaria guardada). Esto permite convocatorias
que empiecen a medianoche y da margen para responder antes del cierre. Se mantienen
las horas locales elegidas, no un desplazamiento UTC fijo. Se toman la plantilla,
las pruebas y las decisiones mantenidas vigentes al generar cada convocatoria; las
ayudas empiezan vacías, como en una creación normal.

No se generan retrospectivamente partidos que ya hayan empezado ni votaciones cuyo
cierre haya pasado. Una convocatoria ya existente para la fecha local se conserva
sin modificarla, incluso si fue cancelada. Los bloqueos siguen el mismo orden de
club y programación que las operaciones de los capitanes; el índice existente de
club/fecha impide duplicados. La fecha siguiente avanza de forma transaccional.

Los horarios inexistentes o ambiguos por cambios de horario se rechazan al crear la
primera convocatoria. Si aparecen en una fecha posterior, esa ocurrencia se omite,
se registra un aviso y la regla continúa con la siguiente fecha. No se cambia la
hora silenciosamente. Errores transitorios de concurrencia se reintentan.

La generación conserva los controles actuales de activación/prueba/Prémium y los
avisos normales. Si expira la activación o el creador deja de ser capitán, la regla
se detiene con un aviso. Un cambio de zona horaria del club también la detiene para
no reinterpretar horarios ya acordados. Las convocatorias existentes no se borran
al detener la repetición.

La tabla tiene RLS de lectura para capitanes. Las escrituras se hacen por RPC que
verifican el rol. El generador es privado y no puede invocarse como usuario normal.
El job pg_cron `convosquad-recurring-call-ups` lo ejecuta el servidor; el teléfono
no necesita estar abierto. No hay una nueva función Edge ni una nueva credencial.

Verificación: pruebas unitarias de días/localización/fechas, pruebas de base de datos
con todas las migraciones para autorización, atomicidad, primera convocatoria,
medianoche, cambio de horario, varias ejecuciones, plantilla nueva, activación,
creador y cambio de zona; pruebas de interfaz a 320 px en los cuatro idiomas,
creación normal y parada de la repetición. TypeScript y lint sin errores.

La función se incluirá en la próxima compilación de iOS y Android. Esta implementación
no genera ni envía automáticamente una nueva versión a las tiendas.
