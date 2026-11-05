# Historial Prémium y retirada de ayudas de Plantilla

El servidor aplicaba el máximo de seis pruebas archivadas a todos los clubes, incluso con Prémium activo. La consulta del cliente también truncaba el historial a seis y mostraba siempre el plan gratuito. `reserve_trial_history_slot` ahora comprueba el Prémium real del club: conserva el límite gratuito y lo elimina para Prémium, manteniendo doce meses de retención.

`read_trial_history` exige capitán, devuelve el estado Prémium, total y entradas con notas privadas, y pagina en bloques de cien para Prémium. La pantalla deja de truncar o identificar como gratuito un club Prémium. Quitar una prueba de Plantilla sigue archivándola y conserva las convocatorias existentes. Incorporarla a la plantilla utiliza la misma comprobación corregida.

Las ayudas de Plantilla tenían una lista sin acción de retirada. Ahora los capitanes tienen una papelera con confirmación. `remove_roster_helper` deja de retener la ayuda en el club sin borrar sus participaciones, contactos ni alineaciones anteriores. Las convocatorias que ya la capturaron mantienen su identidad y pueden seguir guardándose; las nuevas no la ofrecen. Las pruebas retiradas o incorporadas dejan también de retener su alias de invitado para nuevas convocatorias.

Migración `20261105000400_premium_trials_and_roster_helpers.sql` aplicada. Se verificó que WABI SABI tiene Prémium activo y que la consulta devuelve las ocho pruebas archivadas existentes, sin borrar ninguna ni ejecutar retiradas reales durante la comprobación.

Validación: cuatro pruebas de base de datos de límite gratuito/Prémium, incorporación, paginación, caducidad, permisos y conservación de ayudas en convocatorias. Las pruebas de interfaz cubren retirada de prueba, acceso a más de seis archivos y confirmación/privacidad de ayudas. TypeScript, lint, tipos generados y 203 unitarias correctos.
