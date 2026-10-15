# Convocatorias y disponibilidad — Fase 4

## Funcionalidades

Administradores: Crear convocatoria desde Inicio o Convocatoria. La fecha inicial es hoy en la zona horaria del club; fecha y hora son editables (hora inicial 21:50). El formulario valida calendario y horario local, incluidos cambios de horario: rechaza horas inexistentes o ambiguas. La convocatoria se crea abierta tras confirmación.

Se reutiliza el RPC `create_call_up`: copia únicamente la plantilla oficial activa con EA ID, dorsal, categoría, orden y vínculo de cuenta vigente. Todos empiezan Sin responder. Copia PRUEBAS activas como información y no crea AYUDAS. Editar la plantilla no cambia automáticamente las convocatorias; existe una actualización explícita para las de hoy o futuras.

La convocatoria muestra seis categorías, estados y cuatro contadores. PRUEBAS/AYUDAS no cuentan. Los usuarios vinculados responden Disponible, No disponible o Backup con un toque; pueden cambiar su propia respuesta mientras la convocatoria esté abierta y su fecha local sea hoy o futura. Disponible no significa seleccionado para el once. Fichas sin cuenta quedan Sin responder. Ni administradores pueden responder por otro usuario.

Los administradores pueden editar fecha/hora, abrir, cerrar o cancelar con confirmación, filtrar Pendientes y gestionar AYUDAS. La restricción existente `(club_id, local_date)` impide duplicados tanto al crear como al editar, incluso si la convocatoria anterior está cancelada. Cerrar/cancelar conserva los datos. **Reanudar con plantilla actual** actualiza una cancelada y la abre en una sola operación; abrir una cerrada conserva sus snapshots. Las fechas pasadas no pueden abrirse desde la interfaz. AYUDAS solo se modifica en borrador/abierta, conforme a los permisos existentes.

## Actualizar la plantilla de una convocatoria

En **Administrar convocatoria → Actualizar plantilla de convocatoria** se pueden incorporar los cambios actuales sin esperar al día siguiente ni cancelar. Solo está disponible en borrador/abierta y con fecha local de hoy o futura. En una cancelada, **Reanudar con plantilla actual** realiza ambas operaciones juntas. Los iconos disponen de margen superior y separación entre el texto y las acciones.

Ambas acciones piden confirmación y utilizan `refresh_call_up_roster` con autorización del capitán en servidor y bloqueo del club/convocatoria. Copian categoría, orden, dorsal, ID de EA, cuentas y PRUEBAS activas. Se mantienen el identificador de convocatoria, su fecha/hora, las AYUDAS y las respuestas de las fichas que continúan con la misma cuenta. Los nuevos comienzan Sin responder; los jugadores retirados y las pruebas no activas se excluyen de esa convocatoria. Si cambia la cuenta asociada a una ficha, su respuesta se reinicia para no atribuir una respuesta ajena. Las fotografías de otras convocatorias permanecen intactas. No se permite actualizar directamente una cerrada ni una de días anteriores.

Para activar estas dos acciones aplica una sola vez **`supabase/migrations/20261015210000_refresh_call_up_roster.sql`**, después de las migraciones anteriores, en SQL Editor. No repitas el setup inicial. El archivo solo crea el RPC y sus permisos; no modifica datos hasta que un capitán confirme una actualización. No se ha ejecutado SQL remoto durante este desarrollo. No se necesitan variables nuevas ni cambios de Auth.

Ejemplo: si `manoliko91` pasó de centrocampista a atacante, actualiza la plantilla de la convocatoria abierta. Aparecerá en ATACANTES conservando su disponibilidad. No hace falta crear otra convocatoria para ese día.

El historial está en Inicio → Historial de convocatorias o en el icono de historial de Convocatoria. Devuelve las diez convocatorias con fecha local anterior a hoy más recientes (todos los estados), ordenadas por inicio descendente. Las de hoy/futuras se consultan desde Convocatoria; las cerradas/canceladas solo las ve un administrador. No se borran las restantes del historial: el listado se limita a diez. Consultar una fotografía anterior no modifica nada. La edición explícita de su fecha/estado por un administrador usa el mismo RPC existente y conserva los snapshots.

La demo permanece separada y no escribe datos. Autenticación y gestión de plantilla no se han modificado.

## Migración manual

El repositorio contiene cinco migraciones previas y una nueva incremental:

`supabase/migrations/20261014180000_call_up_availability.sql`

No se ha comprobado el registro de migraciones del proyecto remoto ni ejecutado SQL remoto: no hay una sesión administradora disponible. Confirma que las cinco anteriores, incluida la de categorías, ya están aplicadas. No repitas las migraciones ni el script inicial.

1. Revisa la PR y conserva una copia de seguridad antes de cambiar el esquema.
2. En Supabase → SQL Editor abre una consulta nueva y pega **solo** el archivo incremental completo. Incluye BEGIN/COMMIT y debe aplicarse una vez, después de las cinco migraciones anteriores.
3. La migración ajusta la política de lectura de `call_ups`, añade el RPC de historial con autorización administrativa, restringe el RPC de respuesta a los tres estados elegibles y publica las cuatro tablas de convocatorias en `supabase_realtime`. No elimina filas, reconstruye fotografías ni cambia migraciones originales.
4. Comprueba en Supabase la publicación/Realtime de `call_ups`, `call_up_players`, `call_up_trials` y `call_up_aids`, y que RLS sigue activo. Si la publicación ya existe, se conserva y solo se añaden las tablas que falten; si publica todas las tablas, no se amplía.
5. Despliega la versión de la PR en Netlify tras aplicar la migración. No hay variables nuevas: usa las dos variables públicas Supabase existentes durante la build. No se necesitan cambios de Auth, SMTP ni callbacks para estas funciones.

La nueva política protege también las convocatorias pasadas que continúen abiertas. Las políticas de jugadores, pruebas y ayudas de una convocatoria siguen la lectura de su padre, por lo que un jugador normal tampoco puede acceder a sus snapshots por consulta directa. RLS limita los eventos UPDATE de Realtime a filas accesibles; las respuestas solo se escriben mediante RPC.

## Realtime y recuperación

La app escucha INSERT/UPDATE de convocatorias y respuestas filtrados por club; no aplica al estado local el payload recibido. Ante eventos vuelve a leer los datos con la sesión y RLS actuales. Agrupa ráfagas, recupera datos al suscribirse y reconectar y elimina canales/timers al salir o cambiar usuario/club. Recarga al recuperar red, foco web o actividad móvil y tiene un sondeo de recuperación cada 30 segundos y botón manual. También recupera al cambiar el día local o perder acceso a una convocatoria cerrada.

Los cambios INSERT/UPDATE de AYUDAS disparan lectura. Su borrado se recupera inmediatamente para quien lo realiza y por el sondeo/actualización manual en otras sesiones: no se usa una suscripción global a DELETE, ya que Supabase no permite filtrarlo de la misma forma. Las PRUEBAS conservan su snapshot salvo actualización explícita de una convocatoria vigente. El RPC de actualización también modifica `call_ups.updated_at`, para que los clientes vuelvan a consultar incluso cuando se retiren filas.

Que aparezca «Actualización en directo» indica que el canal está suscrito; no certifica por sí solo que lleguen eventos del proyecto. Si falla, la interfaz avisa y conserva la recuperación periódica. **Realtime en producción queda pendiente de una prueba con dos sesiones reales.** No se han creado cuentas ni modificado datos remotos durante el desarrollo.

## Prueba en Netlify con dos sesiones reales

1. Abre la URL real del Deploy Preview si está habilitado o del sitio publicado tras aprobar/fusionar/desplegar la PR. Comprueba el commit en Netlify → Deploys y aplica primero la migración incremental. No se publica ni fusiona automáticamente desde Codex.
2. Usa dos perfiles de Chrome (o uno normal y otro incógnito): administrador del club y jugador miembro con ficha vinculada. Inicia sesión con cuentas existentes y selecciona el mismo club. Estas acciones sí escriben datos reales cuando las ejecutas tú; utiliza un club de pruebas.
3. Crea una convocatoria para hoy con un horario editable. Comprueba las seis categorías, exclusión de inactivos, fotografía de PRUEBAS, AYUDAS vacías y todos Sin responder. Intenta crear otra para la misma fecha: debe mostrar el error de duplicado sin cambios parciales.
4. Mantén Convocatoria abierta en ambas sesiones. Desde el jugador pulsa Disponible, No disponible y Backup. La otra sesión debe actualizar fila y contadores sin recargar manualmente. No debe haber controles para responder por otro jugador ni para fichas sin cuenta. Comprobar solo un canal suscrito no basta.
5. Interrumpe temporalmente la red del segundo navegador, cambia una respuesta en el primero y restablece la conexión. Debe recuperar la respuesta. Prueba también volver a la pestaña, actualización manual y cierre de sesión/cambio de club sin arrastrar datos anteriores.
6. Como administrador, modifica fecha y hora, prueba conflicto con otro día ocupado y revisa Pendientes. Cierra/cancela: la sesión de jugador pierde acceso y el servidor rechaza nuevas respuestas. Si el evento de cierre queda oculto por RLS, la recuperación periódica detecta el cambio; puedes usar Actualizar. Reabre una convocatoria de hoy/futura para volver a responder.
7. Añade/edita/ordena/quita AYUDAS y comprueba que no afectan contadores ni crean fichas. Cierra y verifica que se conserva su contenido.
8. Consulta el historial con el administrador y confirma diez días anteriores como máximo. El jugador no debe ver su enlace y la ruta `/call-up-history` debe devolver a Inicio. Los históricos, incluso abiertos, deben quedar ocultos para el jugador. Cambia la plantilla y comprueba que las fotografías anteriores siguen iguales.
9. Prueba con otro club y confirma que ninguna convocatoria, respuesta ni ayuda se mezcla. Registra el resultado de eventos/reconexión en dos sesiones reales antes de declarar validado Realtime en producción.

## Verificaciones locales

Pruebas SQL sobre PostgreSQL/PGlite: creación/snapshots, exclusión de inactivos, unicidad por día local, edición y conflictos, tres respuestas propias, denegación de respuestas ajenas/directas, cierre/cancelación/reapertura, historial limitado y privado, aislamiento multiclub, conservación de fotografías/respuestas/pruebas/ayudas y publicación con RLS.

Pruebas unitarias: fecha/hora por zona, medianoche y DST, contadores, errores en español, lectura inicial y al suscribirse, ráfagas, reconexión, descarte de canales antiguos, sondeo, recuperación y limpieza al desmontar. No sustituyen la validación del servidor Realtime alojado ni una prueba en dispositivos nativos.

La comprobación de Chromium utiliza dos sesiones completamente simuladas y transporte Supabase HTTP/WebSocket interceptado en local: valida respuesta de un toque visible en la otra sesión mediante el protocolo Realtime, contadores, pendientes, edición horaria, cierre, pérdida de acceso, permisos de historial y fecha inicial. No contacta con Supabase remoto y no demuestra Realtime de producción.
