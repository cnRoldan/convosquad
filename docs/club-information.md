# Información del club

En **Inicio → Administrar el club → Editar información**, los capitanes pueden cambiar nombre, descripción, zona horaria, visibilidad en el buscador público y escudo. El escudo tiene sus propios botones para guardar o quitar la imagen; los demás campos se guardan con **Guardar información**.

Solo el creador ve **Eliminar club** en esta pantalla. La eliminación exige confirmación y conserva las cuentas de los jugadores. La pantalla **Capitanes** queda dedicada a gestionar capitanías.

La migración incremental `20261016230000_edit_club_information.sql` permite cambiar la zona horaria después de crear convocatorias, conservando la validación IANA. No modifica datos existentes, permisos ni políticas RLS. Las convocatorias existentes conservan zona, fecha, horario y respuestas; las nuevas usan la zona del club. La restricción de una convocatoria por club y fecha local continúa activa.
