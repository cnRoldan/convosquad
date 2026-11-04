# Jugadores que aparecen al valorar

La lista inicial de valoración usa las fichas de convocatoria correspondientes a los titulares del once publicado. No utiliza el voto Disponible, ni el banquillo, ni los borradores. El cruce se realiza mediante `source_player_id`, no por nombre, dorsal o cuenta de usuario.

Los capitanes pueden añadir manualmente a otros jugadores de la convocatoria para participaciones de última hora o para consultar valoraciones/incidencias ya guardadas fuera del once. Esos registros no se eliminan ni se sobrescriben por quedar fuera de la lista inicial. Tras guardar o recargar, la lista vuelve a los titulares; una nota indica si existen registros de otros jugadores.

Sin once publicado, la pantalla lo explica y permite seleccionar manualmente a quienes participaron. Si falla la consulta del once, se muestra el error con reintento; no se sustituye la selección por la disponibilidad. Se conservan los permisos, plazos y control de concurrencia de las valoraciones.

La RPC `read_rating_lineup` requiere capitán del mismo club y solo devuelve la existencia de publicación y los identificadores de fichas de convocatoria de titulares. No devuelve la imagen, posiciones ni el documento histórico protegido por Prémium.

Migración `20261104000200_rating_lineup_participants.sql` aplicada en Supabase. Validación: pruebas de permisos y selección en base de datos, ocho pruebas visuales de valoraciones/incidencias, catálogos de idiomas, TypeScript y lint.

La nota se elige con botones horizontales de 0 a 10, desplazables en pantallas estrechas y con un mínimo de 44 puntos de alto/ancho. Debajo aparecen «Sin valorar» y una papelera para marcar «No alineado». La nota o estado elegido se puede cambiar antes de guardar; la papelera conserva el registro y usa `not_selected`, sin convertirlo en cero ni incluirlo en la media. Se mantiene el guardado explícito y el bloqueo fuera del plazo o durante el envío.

## Media de los capitanes por partido

Cada ficha muestra «Valoración media capitanes:» con dos decimales para esa convocatoria. El selector representa únicamente la nota del capitán conectado. La media utiliza notas guardadas, incluye los ceros y excluye «Sin valorar» y «No alineado». Sin notas numéricas se muestra «Sin valoraciones». Se actualiza al entrar, tras guardar y cada 20 segundos, sin restablecer cambios pendientes del selector. Los errores de actualización se indican con reintento.

La migración `20261104000500_captain_rating_averages.sql`, aplicada en Supabase, conserva votos independientes en `private.captain_player_ratings`, sin acceso directo desde clientes. Los RPC `read_my_player_ratings`, `save_my_player_ratings` y `read_call_up_rating_averages` requieren capitán del mismo club; se mantienen plazos, concurrencia y recordatorios. Una modificación concurrente de otro capitán no impide guardar mi nota; otra sesión del mismo capitán sí requiere recargar.

`player_ratings` mantiene una sola fila por jugador y partido con la media, ahora decimal, para que rendimiento e histórico cuenten cada partido una vez. Los clientes antiguos conservan su RPC y comprobación de la revisión compartida; al borrar solo retiran su voto. Los votos ya existentes se migran con su autor y fecha: únicamente se puede conservar la última nota guardada bajo el modelo anterior. No se inventan notas sobrescritas. La limpieza a los tres meses incluye votos individuales.

Validación: 201 pruebas unitarias, 12 de base de datos (medias y plazos/avisos), 5 de interfaz de valoraciones/incidencias, TypeScript, lint y tipos generados. Se cubren migración de notas previas, privacidad, cero y exclusiones, concurrencia, borrado individual, clientes antiguos, aislamiento por partido y actualización periódica sin perder ediciones.

En el despliegue se conservaron las 38 valoraciones existentes como 38 votos previos. La interfaz nativa requiere una nueva compilación.
