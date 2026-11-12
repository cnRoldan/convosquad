# Eliminación de cuenta

Menú del ID de EA → **Eliminar mi cuenta** abre directamente el flujo desde
cualquier pantalla autenticada. También sigue disponible en Mis clubes. El menú
espera a que termine de cerrarse su modal antes de navegar, para evitar bloquear
la interacción en iOS. Ambos accesos abren el mismo flujo que la página pública
`https://convosquad.netlify.app/delete-account`. Esta URL se puede registrar como
recurso de eliminación en Google Play; permite iniciar sesión y completar la
eliminación desde el navegador, sin instalar la aplicación.

La pantalla explica el alcance y requiere contraseña actual, escribir el ID de EA
y confirmar el diálogo definitivo. No se elimina nada al iniciar sesión, abrir
la página o cancelar. Los mensajes están traducidos a español, inglés, alemán y francés.

## Seguridad y datos

`delete_my_account(p_confirmation)` no acepta UUID de destino: usa `auth.uid()`.
Exige que exista el perfil, coincida el ID de EA y que el JWT tenga autenticación
por contraseña en los últimos cinco minutos (`amr`). La contraseña se comprueba
con Supabase Auth mediante un cliente efímero sin persistencia; la llamada RPC
utiliza esa nueva sesión. La contraseña no llega al RPC ni se guarda en el dispositivo.

La transacción bloquea los clubes afectados y comprueba nuevamente el último
capitán. Si queda un club sin capitán, revierte todo. La pantalla identifica esos
clubes y permite abrirlos para designar otro capitán o eliminarlos. Cuando se
borra al creador y queda otro capitán, se transfieren a ese capitán los controles
reservados al creador, incluida la eliminación del club.

Se eliminan la identidad de Auth, sus sesiones y tokens de renovación, el perfil,
membresías, solicitudes, preferencias, dispositivos push, candados, fichas
vinculadas, snapshots de votos (también históricos), valoraciones recibidas,
eventos de voto propios y entregas push con copias de sus tokens. Las pruebas
incorporadas vinculadas a esas fichas se eliminan con sus teléfonos, notas y
snapshots. Las invitaciones creadas por la cuenta se invalidan eliminándolas.
Las referencias de autor sobre datos compartidos quedan sin identificación.

Se conservan los clubes compartidos, sus escudos y los datos de otros jugadores.
Las transacciones de tienda conservan su asociación al club para procesar
renovaciones y reembolsos, pero pierden la referencia al perfil eliminado. La
migración `20261112000100_account_deletion_purchases.sql` sustituye el bloqueo de
borrado del comprador por `ON DELETE SET NULL`; no borra compras ni cuentas al
aplicarse. La prueba SQL incluye eliminar al comprador y procesar una renovación
posterior sobre el mismo club.
Del escudo compartido se retira la identidad del usuario que lo subió; no se
elimina el objeto ni su archivo. No se intenta inferir identidades en textos libres
o registros de ayudas/pruebas sin vínculo con la cuenta: las solicitudes sobre
esos datos requieren revisión por soporte. Los respaldos y registros operativos
del proveedor siguen sus propias políticas de retención; este flujo borra los
registros activos, no reescribe respaldos. La política de privacidad final debe
explicar estos límites con la configuración de retención real del proyecto.

La app limpia la sesión local, selección de club, invitaciones y avisos pendientes,
preferencias locales de esa cuenta y caché de escudos. El cierre no intenta
actualizar un dispositivo push ya eliminado. Un fallo al cerrar la sesión temporal
no transforma una eliminación completada en un error que invite a repetirla.

## Despliegue y comprobación

Aplicar `20261019000100_delete_own_account.sql` antes de publicar el cliente. La
migración solo crea funciones y permisos; no elimina cuentas ni datos al aplicarse.
Requiere el esquema estándar de Supabase Auth y Storage. Los tipos se generan con
`npm run db:types`; el generador admite RPC sin argumentos.

Las pruebas SQL usan PGlite y las pruebas de cliente/navegador interceptan Auth:
ninguna prueba borra cuentas remotas. Cubren sesión reciente, identidad, permisos,
último capitán, limpieza del historial, conservación de otros jugadores,
transferencia de creador, contraseña incorrecta, cancelación y cierre local.

## Evidencia para App Review (5.1.1(v))

Apple solicitó el 12 de noviembre de 2026 un vídeo grabado en un dispositivo
físico, mostrando alta o inicio de sesión, navegación al borrado y todo el proceso
hasta la confirmación. Las pruebas de navegador no sustituyen esa evidencia.

Usar una cuenta desechable, sin clubes, para no borrar las cuentas de revisión
con contenido ni el club real. Grabar desde el alta/inicio de sesión, abrir el
menú del ID de EA, pulsar Eliminar mi cuenta, completar contraseña e ID, confirmar
Eliminar definitivamente y mostrar el mensaje de éxito. Añadir el enlace accesible
al vídeo a las notas de revisión y responder al rechazo con la ruta exacta y la
compilación utilizada. Si se prueba con un capitán único, antes debe transferir
el rol o eliminar su club; el flujo explica esta condición.
