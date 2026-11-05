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

## Resumen del período: todas las notas

La migración `20261104000600_performance_all_captain_votes.sql`, aplicada en Supabase, calcula la media de rendimiento con todas las notas numéricas individuales del período: suma de notas dividida entre número de notas. Cada voto pesa lo mismo, aunque distintos partidos tengan diferente número de capitanes votantes. No se promedian medias por partido ni se usan medias ya redondeadas. Los ceros cuentan y las exclusiones no.

El histórico sigue mostrando la media de cada partido y el contador cuenta partidos distintos. La interfaz distingue «Media capitanes» de «partidos valorados». Se mantienen la visibilidad del club y los filtros de período. Las filas históricas sin desglose individual se consideran una nota conservada. La prueba de dos notas 7 y 8 en un partido y una nota 10 en otro exige 8,33 en el resumen y dos partidos valorados.

Validación: 12 pruebas de base de datos de medias y plazos, 201 unitarias, TypeScript, lint y tipos generados correctos. La nueva fórmula ya está en el servidor; los textos nativos llegarán con la próxima compilación.

## Media histórica al alinear

El capitán ve una insignia pequeña en la esquina superior derecha del jugador, tanto en el campo como en el banquillo y en el selector (incluidas sugerencias). Usa `get_player_performance` con período `3m`: la misma media de todos los votos individuales que el resumen, asociada al identificador del jugador, sin cruzar por nombre. No hay datos conservados anteriores a tres meses. El aviso de incidencias sigue a la izquierda.

Rangos sin huecos ni solapamientos: rojo `[0,4)`, naranja `[4,5)`, amarillo `[5,7)` y verde `[7,10]`. El tramo de 3 a 4 se incluye en rojo para completar los rangos de la propuesta. El número conserva hasta dos decimales; los jugadores sin notas numéricas muestran «—» en gris, nunca un cero inventado. Las insignias se consultan únicamente para capitanes y no se añaden a la imagen compartida. Al actualizar la pantalla se recargan también las medias; un error permite reintentar sin bloquear la alineación.

Validación: 202 pruebas unitarias y 18 de interfaz, TypeScript y lint. Se comprueban límites decimales, ausencia de historial, incidencias simultáneas, sustituciones, banquillo/selector y privacidad de jugadores. La interfaz requiere una compilación posterior a iOS 24 / Android 25.

La esquina superior izquierda del campo muestra «VAL MED:» en escala 0–100: media aritmética de las medias históricas de los jugadores colocados en el once, multiplicada por 10 y redondeada al entero más cercano. Cada jugador con nota cuenta una vez, incluyendo las notas cero; el banquillo, los slots vacíos y jugadores sin historial no entran en el denominador. Sin ninguna nota disponible se muestra «—». El valor cambia inmediatamente al sustituir o retirar jugadores y solo aparece donde están disponibles las medias para el capitán. No se incorpora al documento de alineación ni al cartel compartido.

Validación del indicador: 203 pruebas unitarias, dos pruebas de interfaz dirigidas a sustituciones y privacidad, TypeScript y lint correctos.

## Acceso a la vista de alineación

El editor de `/lineup` es exclusivo para capitanes. Convocatoria muestra «¡Forma tu 11!» a capitanes y «Consulta el 11» a jugadores; estos últimos solo acceden al cartel publicado. Las indicaciones personales siguen accesibles desde Convocatoria.

La migración `20261105000100_captain_only_lineup_view.sql`, aplicada en Supabase, exige administración activa del mismo club en `read_lineup` y `read_lineup_access`. Los clientes antiguos tampoco pueden consultar el campo. Se conservan los controles de activación, cuota mensual e histórico Prémium. Prémium no concede este acceso a jugadores.

Validación: 10 pruebas de base de datos (permisos, historial e indicaciones), 18 de interfaz de alineación/valoraciones y 4 dirigidas de Convocatoria, 203 unitarias, TypeScript, lint y tipos generados. El bloqueo del editor en el servidor ya está activo.

## Consulta de la imagen publicada

«Consulta el 11» abre dentro de la app únicamente el cartel publicado, sin descargar ni compartir archivos, notas históricas, VAL MED ni controles del editor. Una consulta separada `read_published_lineup` devuelve solo los campos permitidos del snapshot publicado, nunca los borradores. No requiere consumir generaciones del once. Cambiar un borrador no cambia el cartel hasta que el capitán lo publique de nuevo. Sin publicación se informa al jugador y no se muestra una alineación provisional.

La migración `20261105000200_published_lineup_image.sql`, aplicada en Supabase, exige pertenencia activa al mismo club y convocatoria abierta/cerrada. Se conserva la restricción Prémium de imágenes históricas. La pantalla carga el escudo y permite actualizar al volver a ella o mediante el gesto de recarga. Los RPC del editor siguen reservados a capitanes.

Validación: 6 pruebas de base de datos de acceso y publicación, 20 de interfaz de alineación/valoraciones y 4 dirigidas de Convocatoria; unitarias, TypeScript, lint y tipos generados. Se verifica que no haya descargas ni consultas al editor desde la vista del jugador. La interfaz nativa requiere una nueva compilación.
