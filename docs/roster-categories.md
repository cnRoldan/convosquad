# Categorías, PRUEBAS y AYUDAS

## Migración incremental

La nueva migración es `20261014120000_roster_categories_trials.sql`. Depende de las cuatro migraciones anteriores. El script inicial y las migraciones ya aplicadas permanecen intactos. **No se ha aplicado esta migración a Supabase remoto.**

No se dispone de una sesión autenticada de administrador en Codex para inventariar jugadores o convocatorias privadas. La clave publicable y RLS no permiten determinar que una base esté vacía. Se ha probado la actualización sobre datos previos locales, incluyendo un usuario vinculado, una respuesta Disponible, una convocatoria cerrada y un jugador cuya posición cambió después de convocarlo.

| Identificador interno | Categoría | Posiciones anteriores |
| --- | --- | --- |
| `goalkeepers` | PORTEROS | POR |
| `centre_backs` | CENTRALES | DFC |
| `wide_backs` | LATERALES / CARRILEROS | LI, LD |
| `midfielders` | CENTROCAMPISTAS | MCD, MC, MCO, MI, MD |
| `attackers` | ATACANTES | EI, ED, DC |
| `backups` | BACKUPS | Ninguna conversión automática |

Las etiquetas solo viven en la interfaz; el enum conserva el orden fijo de los seis identificadores. `players.category` y `sort_order` son el modelo actual. La migración asigna el orden inicial por dorsal, EA ID e ID dentro de cada club/categoría. Cambiar de categoría o reactivar una ficha la coloca al final del grupo; el orden manual se aplica al conjunto completo de jugadores activos. Las categorías históricas se derivan de `position_snapshot`, nunca de la ficha actual. Las convocatorias antiguas no tenían orden manual almacenado: se añade un orden determinista a partir de su dorsal/EA ID/UUID históricos, sin copiar el orden actual de la plantilla. Los campos antiguos, respuestas, fechas de respuesta y titulares se conservan.

BACKUPS es una categoría habitual de plantilla, con las mismas opciones de cuenta y respuesta que cualquier otra. `availability = 'backup'` sigue siendo una respuesta independiente. Al convocar todos empiezan `unanswered`, también los BACKUPS.

## Compatibilidad y despliegue

`position` y `position_snapshot` se mantienen para no eliminar datos históricos ni romper las RPC antiguas. Las altas antiguas con posición se convierten a categoría; cambiar una posición desde un cliente antiguo también puede cambiar la categoría y enviarla al final de su grupo. Las fichas nuevas de esta versión utilizan categoría: el campo obsoleto `position` recibe por defecto MC y **no debe interpretarse como su posición principal**. No hay equivalente individual correcto para BACKUPS. Las posiciones libres de PRUEBAS se conservan en su ficha y su snapshot, sin intentar adivinarlas al incorporar.

Es necesario aplicar la migración antes de desplegar esta versión de la app. Un cliente antiguo no entiende categorías, orden, pruebas ni ayudas y podría interpretar mal el campo obsoleto. Recomendamos actualizar los clientes tras aplicar la migración y no mantener editores antiguos activos. Una posición desconocida ajena al esquema versionado provoca el fallo de la migración en lugar de asignar una categoría arbitraria. No hay eliminación ni fusión automática de jugadores.

El script inicial sigue conteniendo únicamente las cuatro migraciones originales. Para una instalación completamente nueva, aplica esa base una sola vez y después esta migración; para tu proyecto ya instalado, aplica **solo la nueva**.

## PRUEBAS

`club_trials` guarda nombre/EA ID, dorsal opcional, posición libre, observaciones, orden y fecha de creación. Los estados son `active`, `withdrawn` e `incorporated`. Retirar una prueba cambia su estado, sin borrar la ficha ni sus snapshots. Los administradores ven también los estados anteriores y pueden abrir la ficha oficial vinculada.

`promote_trial` bloquea el club y la prueba, comprueba administración y estado, y crea la ficha sin usuario o reutiliza una ficha del mismo club con el mismo EA ID. La selección de categoría es explícita. Si una prueba usa un nombre distinto del EA ID real, hay que corregirlo antes de incorporar o reutilizar una ficha; no se fusionan identidades por parecido. Un duplicado no se resuelve silenciosamente: la interfaz avisa y requiere confirmar la reutilización. Se conserva la cuenta/dorsal existente si se reutiliza una ficha; se rellena un dorsal vacío con el de la prueba. Las observaciones y posición libre quedan en la prueba para trazabilidad. No se crean cuentas ni se inventan titulares.

La operación marca la prueba como incorporada y guarda `player_id` e `incorporated_at` en la misma transacción. Si falla, no cambia nada. Los snapshots anteriores de pruebas no se alteran ni se convierten en respuestas oficiales.

## Convocatorias e históricos

`create_call_up` copia categoría y orden de jugadores activos y crea `call_up_trials` con una fotografía de pruebas activas, incluyendo su posición libre y observaciones. Las convocatorias anteriores a esta migración no reciben pruebas retrospectivamente: esa información no existía y no se inventa.

`call_up_aids` pertenece a una única convocatoria, con anotación, orden y fecha. Cada convocatoria nueva empieza sin ayudas; no se copian las de la anterior. Solo se permite editarlas en borrador o abiertas. Al cerrar/cancelar quedan de lectura para conservar el histórico. El borrado de una ayuda abierta solicita confirmación y no elimina jugadores ni pruebas.

Las secciones siguen los permisos existentes de su convocatoria: abiertas para miembros activos; borradores, cerradas y canceladas para administradores. No se amplía la visibilidad histórica anterior. PRUEBAS actuales del club son legibles por sus miembros; únicamente administradores pueden gestionarlas.

La pantalla permite elegir convocatorias accesibles, ver categorías y snapshots, gestionar AYUDAS y responder solo por la ficha propia mientras está abierta. El alta de una convocatoria usa fecha y hora del club; las horas inexistentes o repetidas por cambios de horario se rechazan para evitar una conversión ambigua a UTC. Se mantiene la restricción de una convocatoria por día local y el bloqueo de cambios de zona después de la primera convocatoria.

## Importación desde WhatsApp

El parser separado reconoce encabezados oficiales y anteriores, incluidos PORTERO, CARRILEROS, MCDs / Volantes, MCOs, DELANTEROS y BACK UP. Convierte emojis numéricos a dorsal, conserva espacios legítimos y números del EA ID, y retira emojis decorativos. Bajo encabezados conserva sufijos como «My EA MC»; los paréntesis explícitos se tratan como la posición indicada.

Las cabeceras FC, fecha y día/hora quedan informativas; no programan ni editan una convocatoria. ✅, ❌ y 🟡 se muestran como disponibilidad detectada, pero no forman parte del payload que se guarda. BACK UP como encabezado indica categoría, no una respuesta Backup.

PRUEBAS se importa como fichas independientes. Entradas como «1 dfc» son ambiguas: requieren corregir nombre/dorsal/posición y confirmar explícitamente su interpretación o excluirlas. Los encabezados desconocidos no se importan silenciosamente. AYUDAS aparece en la vista previa, pero queda fuera del lote de plantilla: debe añadirse explícitamente a una convocatoria desde su sección AYUDAS. No se asigna una ayuda a una convocatoria por adivinar la fecha del mensaje.

`import_roster` guarda jugadores y pruebas en una única transacción, manteniendo su orden original, sin sobrescribir fichas. Rechaza disponibilidad, titulares, órdenes falsificados y campos extra; impone 1–100 entradas, valida tipos y evita duplicados en la plantilla y pruebas activas. Los dorsales repetidos son advertencias, ya que no son únicos en el esquema. El lote entero se revierte si falla una entrada.

## Aplicar desde Supabase SQL Editor

1. Antes del cambio, revisa la PR y verifica en Table Editor si hay jugadores/convocatorias. Guarda un respaldo con el mecanismo disponible en tu plan de Supabase. Comprueba que las cuatro migraciones anteriores estén instaladas. Evita escrituras de clientes antiguos durante el cambio.
2. En SQL Editor abre una consulta nueva. Copia **íntegro** `supabase/migrations/20261014120000_roster_categories_trials.sql`, incluyendo BEGIN/COMMIT. Ejecútalo una sola vez. No vuelvas a ejecutar el script inicial.
3. Si aparece un error, detente y conserva el mensaje; no borres datos para forzar la aplicación. La transacción impide una actualización parcial.
4. Comprueba las seis categorías y sus cantidades en `players`, y compara las respuestas/posiciones históricas conocidas. Verifica que existen `club_trials`, `call_up_trials` y `call_up_aids`, todas con RLS. Si antes había jugadores y no elegiste BACKUPS manualmente, no debe aparecer ninguno convertido a esa categoría.
5. Despliega/recompila la nueva app. Prueba con un administrador y un jugador, cada uno en su propio club. La prueba completa debe hacerse en desarrollo antes de usar el cambio con tu equipo.

Consultas de comprobación de solo lectura:

```sql
select (select count(*) from public.players) as jugadores,
       (select count(*) from public.call_ups) as convocatorias;
select category, count(*) from public.players group by category order by category;
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('club_trials', 'call_up_trials', 'call_up_aids');
```

SQL Editor no registra automáticamente el historial del CLI. Guarda la versión aplicada y el commit; reconcilia ese historial antes de adoptar `db push`. No se modifica `private` como esquema expuesto de la API.

## Validación y pendientes

Las pruebas SQL cubren la migración sobre datos anteriores, categorías/orden, privacidad, promoción atómica, reutilización autorizada, snapshots, ayudas aisladas y permisos. Las unitarias cubren el ejemplo real, emojis, espacios, secciones, ambigüedad, duplicados, orden y horario del club. La demo es de solo lectura y no toca Supabase.

Quedan pendientes la aplicación por el propietario y su confirmación, un recorrido real con usuarios autenticados, pruebas nativas y concurrencia entre conexiones. No se ha inventariado el contenido privado remoto. No se ha aplicado SQL ni modificado datos reales. Realtime, push y edición de fecha/estado de convocatorias desde la interfaz continúan fuera de esta fase.
