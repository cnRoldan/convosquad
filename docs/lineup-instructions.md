# Indicaciones privadas por convocatoria

En el selector de un jugador de plantilla alineado, el capitán puede añadir o editar hasta 1000 caracteres de indicaciones. El formulario modifica el borrador local y activa el aviso de cambios sin guardar. Guardar el borrador o publicar persiste las indicaciones de forma atómica junto con la revisión del borrador. Cada borrador tiene sus propias indicaciones, asociadas al identificador de ficha, no al hueco del campo.

Al publicar, solo se entregan las indicaciones de jugadores presentes en los once slots. Los textos de borrador no se entregan antes de publicar. Cambiar de jugador o quitar una indicación elimina la copia publicada que ya no corresponda; cambiar de posición conserva la asociación al jugador. Los borradores de otras convocatorias no heredan estas indicaciones.

Debajo del campo, «Mis indicaciones» muestra al jugador únicamente sus indicaciones publicadas para esa convocatoria. Los capitanes tienen «Indicaciones de jugadores», con el listado completo. El acceso también está disponible desde Convocatoria y no requiere consultar una alineación histórica Prémium. Si no hay cuenta vinculada activa, el texto queda disponible para los capitanes y no se genera aviso al jugador.

## Privacidad y avisos

- Las tablas `lineup_draft_instructions` y `lineup_instructions` tienen RLS activado y no permiten acceso directo de clientes. Sus RPC comprueban administración o pertenencia activa al club y destinatario.
- Los textos nunca forman parte del JSON del once, de la imagen exportada ni de snapshots públicos. `list_lineup_drafts` entrega las indicaciones únicamente al capitán autorizado y mantiene el control Prémium previo para borradores históricos.
- La publicación captura la cuenta destinataria vinculada en ese momento. Solo se genera una entrega para sus dispositivos activos; no se distribuye a otros compañeros ni a los capitanes por ser capitanes.
- El push `lineup_instruction` tiene texto genérico, sin la instrucción privada, y no admite acciones de disponibilidad. Al abrirlo se comprueban cuenta, club y convocatoria antes de mostrar el modal.
- Una indicación publicada sin cambios conserva su identificador y no duplica avisos. Cambiarla crea un identificador nuevo. Al reclamar entregas se descartan indicaciones retiradas o reemplazadas, miembros/dispositivos revocados y convocatorias terminadas o canceladas.
- Los clientes antiguos pueden guardar borradores con el RPC anterior sin borrar sus indicaciones privadas. La nueva publicación sigue conservando la confirmación obligatoria de incidencias.

## Despliegue y validación

Migración `20261104000300_lineup_instructions.sql` aplicada. Worker `send-reminders` desplegado y activo, versión 10, manteniendo su autenticación mediante secreto del worker.

Pasan 195 pruebas unitarias, 12 pruebas específicas de base de datos (indicaciones e incidencias), 13 pruebas visuales del editor/valoraciones, TypeScript, lint, tipos generados y comprobación Deno del worker. Las pruebas cubren privacidad, borradores separados, destinatarios, avisos repetidos/obsoletos, enlaces para otra cuenta y el recorrido de escritura, publicación y consulta. La recepción push en dispositivo físico queda para la compilación que incluya esta interfaz; las versiones iOS 23/Android 24 ya programadas no contienen este cambio.
