# Jugadores que aparecen al valorar

La lista inicial de valoración usa las fichas de convocatoria correspondientes a los titulares del once publicado. No utiliza el voto Disponible, ni el banquillo, ni los borradores. El cruce se realiza mediante `source_player_id`, no por nombre, dorsal o cuenta de usuario.

Los capitanes pueden añadir manualmente a otros jugadores de la convocatoria para participaciones de última hora o para consultar valoraciones/incidencias ya guardadas fuera del once. Esos registros no se eliminan ni se sobrescriben por quedar fuera de la lista inicial. Tras guardar o recargar, la lista vuelve a los titulares; una nota indica si existen registros de otros jugadores.

Sin once publicado, la pantalla lo explica y permite seleccionar manualmente a quienes participaron. Si falla la consulta del once, se muestra el error con reintento; no se sustituye la selección por la disponibilidad. Se conservan los permisos, plazos y control de concurrencia de las valoraciones.

La RPC `read_rating_lineup` requiere capitán del mismo club y solo devuelve la existencia de publicación y los identificadores de fichas de convocatoria de titulares. No devuelve la imagen, posiciones ni el documento histórico protegido por Prémium.

Migración `20261104000200_rating_lineup_participants.sql` aplicada en Supabase. Validación: pruebas de permisos y selección en base de datos, ocho pruebas visuales de valoraciones/incidencias, catálogos de idiomas, TypeScript y lint.

La nota se elige con botones horizontales de 0 a 10, desplazables en pantallas estrechas y con un mínimo de 44 puntos de alto/ancho. Debajo aparecen «Sin valorar» y una papelera para marcar «No alineado». La nota o estado elegido se puede cambiar antes de guardar; la papelera conserva el registro y usa `not_selected`, sin convertirlo en cero ni incluirlo en la media. Se mantiene el guardado explícito y el bloqueo fuera del plazo o durante el envío.
