La última convocatoria finalizada de cada club se puede valorar desde `ends_at` hasta `ends_at + 24 horas`, sin incluir el instante del vencimiento. Una convocatoria activa no sustituye a la última finalizada. Si termina una nueva convocatoria sin valoración habilitada, no se recupera una anterior.

El servidor aplica el mismo límite al listado y al guardado, incluyendo la edición y el borrado de notas. La pantalla oculta las convocatorias vencidas y desactiva el editor aunque permanezca abierto. Las notas guardadas mantienen el histórico de rendimiento de tres meses.

Cada guardado correcto que incluye al menos una nota o «No convocado» registra la participación del capitán. Una petición fallida o un lote que solo borra notas no la registra. Las notas del club siguen siendo compartidas; este registro evita que una edición posterior de otro capitán vuelva a marcar al primero como pendiente.

Se conserva el aviso de apertura y se añade un único recordatorio cuando han pasado 19 horas desde la finalización. Se dirige a los capitanes activos que no hayan guardado ninguna valoración para esa convocatoria. Antes de reservar cada envío se vuelven a comprobar el plazo, la última convocatoria, la programación y los permisos del destinatario. El cron existente comprueba los avisos una vez por minuto; no se reenvían entregas cuyo resultado sea ambiguo.

El recordatorio dice «¡Valora a tus jugadores en su última convocatoria antes de que expire el tiempo!» y abre el editor de la convocatoria finalizada, comprobando la cuenta y el rol. La migración `20261021000200_rating_deadline.sql` reconoce las notas anteriores por su autor para evitar recordatorios innecesarios después del despliegue.
