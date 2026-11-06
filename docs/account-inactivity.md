# Detección de cuentas inactivas

Primera fase: registro del uso y detección para revisión. No se envían avisos ni se eliminan cuentas automáticamente. Tampoco se desactivan membresías o fichas por inactividad. La automatización de los avisos y del borrado requiere la siguiente fase, con entrega del aviso y comprobación de elegibilidad antes de cada eliminación.

## Actividad

`private.account_activity` guarda la última actividad por cuenta. `record_account_activity()` solo admite la identidad autenticada y la hora del servidor. La app registra al entrar en primer plano y comprueba cada minuto mientras sigue visible, con una escritura como máximo cada 15 minutos. Se excluyen el modo demo, recuperación de contraseña y cierre de sesión; renovar el token no reinicia el seguimiento. Un fallo de red no impide utilizar la app y se reintenta en la siguiente comprobación.

Las cuentas existentes parten de la fecha de instalación de la migración; no se deduce actividad anterior a partir de la fecha del login. Las cuentas nuevas reciben la fecha de creación. El seguimiento del uso empieza cuando se utiliza una versión de la app que incluya este cambio; los clientes anteriores no envían esta señal. Al volver a utilizar la app, una cuenta deja de aparecer como inactiva tras actualizar el listado.

## Umbrales y acceso

La vista privada `account_inactivity_review` clasifica las cuentas:

- Sin membresía activa en ningún club ni ficha vinculada (incluidas fichas inactivas): `orphan_warning_due` a los 60 días y `orphan_review_due` a los 90 días. Son candidatos para preparar avisos/revisión, no una cola de borrado.
- Con membresía o ficha: `member_review_due` a los 6 meses naturales. Se conserva toda su información.
- También identifica si la cuenta es el único capitán activo de algún club para su tratamiento separado.

La tabla y la vista no son accesibles desde clientes. Los capitanes activos solo pueden consultar `list_inactive_club_members(club_id)` en su propio club. La pantalla Solicitudes pendientes muestra «Miembros inactivos», fecha de último uso, rol y si falta ficha. El estado de único capitán también se incluye. No se exponen correos ni actividad de otros clubes. La eliminación de la cuenta por su titular sigue borrando el registro de actividad por cascada.

## Validación

Pruebas de seguimiento en primer plano/segundo plano, intervalos, concurrencia, reintento y cambio de cuenta; pruebas de base de datos para los umbrales de 60/90 días y 6 meses, privacidad entre clubes, ficha inactiva, último capitán, actualización de actividad y conservación de cuentas. La prueba de navegador de Solicitudes pendientes comprueba el apartado y la fecha de actividad.
