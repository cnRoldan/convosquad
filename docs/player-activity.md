# Quitar y reincorporar jugadores

Las tarjetas de Plantilla muestran el EA ID una sola vez y el dorsal/estado de registro en una línea secundaria. Los administradores tienen una fila compacta de cuatro iconos SVG: subir, bajar, editar y quitar. Cada acción tiene un área táctil de 44 × 44 puntos y una etiqueta accesible que identifica al jugador. La fila se sitúa junto a los datos cuando cabe y debajo en móvil; subir/bajar están deshabilitados en los extremos, con filtros o en la demo. Los jugadores normales no ven acciones administrativas.

Los administradores pueden pulsar la papelera o abrir la ficha con el lápiz y pulsar **Quitar de la plantilla**. La confirmación dice: «¿Quieres quitar a este jugador de la plantilla? Sus convocatorias anteriores se conservarán.» Cancelar no guarda cambios. Confirmar actualiza únicamente `players.is_active` a `false` y muestra un aviso de éxito en la plantilla.

La ficha deja de aparecer en la plantilla activa y el RPC existente `create_call_up` la excluye de las convocatorias nuevas. No se elimina la ficha, la cuenta de Supabase Auth, la membresía ni las respuestas/snapshots anteriores. Las convocatorias abiertas que ya incluían al jugador tampoco se reescriben.

En **Plantilla → Jugadores inactivos**, un administrador puede consultar la ficha y pulsar **Reincorporar a la plantilla**. Se conserva el ID de ficha, EA ID, dorsal, categoría y cuenta vinculada. El trigger existente la coloca al final de su categoría. Solo las convocatorias creadas después de reincorporarla la incluyen; las existentes no cambian.

## Permisos y conflictos

La ruta administrativa requiere el rol administrador del club activo. Las acciones comprueban también el rol en el cliente y las consultas de actividad se acotan por club e ID. La política existente `players_update_admin` exige `private.is_admin(club_id)` tanto en USING como en WITH CHECK. Un jugador normal, incluso el titular de la ficha, no puede cambiar su actividad ni la de otros; un administrador de otro club tampoco puede hacerlo.

No se añade ninguna migración. Se reutilizan `is_active`, las políticas, índices y el trigger de la migración de categorías ya existente. Esta versión presupone que las cinco migraciones anteriores están aplicadas. No se debe repetir ninguna para este cambio.

El EA ID y la cuenta vinculada siguen reservados dentro del club en fichas inactivas. No puede crearse otra ficha con esos mismos identificadores para después reincorporar la anterior. Los índices únicos protegen también frente a operaciones simultáneas. La aplicación muestra conflictos, falta de permisos y errores de conexión en español sin copiar detalles privados del servidor. Los dorsales no tienen unicidad en el esquema y pueden compartirse: no se introduce una restricción nueva ni se cambia el dorsal al reincorporar. La categoría admite varios jugadores.

La interfaz no ofrece borrado físico y se ha eliminado el helper de borrado que no utilizaba ninguna pantalla. Las políticas SQL originales se conservan; este cambio no revoca permisos de borrado existentes para administradores que accedan directamente a la API. La consulta de fichas inactivas ya era accesible a miembros por la política de lectura existente, aunque la sección administrativa de la app solo está disponible para administradores.

## Probar desde Netlify

1. Revisa esta PR. Para probar antes de fusionar puedes usar un Deploy Preview si está habilitado en tu sitio Netlify; de lo contrario, tras aprobar/fusionar la PR, espera al despliegue de `main`. No se publica ni fusiona automáticamente desde Codex.
2. En Netlify → Deploys comprueba que el deploy corresponde al commit de esta PR y abre su URL HTTPS real. Conserva las variables públicas Supabase que ya utiliza el sitio. No hay nuevas variables ni SQL que ejecutar. Para login por correo/contraseña no se necesita añadir un callback nuevo; si registras o recuperas contraseña desde un preview, autoriza previamente su callback HTTPS en Supabase.
3. Inicia sesión con una cuenta administradora, selecciona el club correcto y abre Plantilla. Usa una ficha destinada a pruebas: estas acciones sí escriben datos reales cuando las ejecutas tú en el sitio.
4. Abre la ficha, pulsa Quitar de la plantilla y cancela. Debe seguir activa. Repite y confirma: aparece el aviso, sale de la plantilla y figura en Jugadores inactivos.
5. Comprueba una convocatoria anterior que incluya la ficha: sus datos/respuestas no cambian. Si creas una convocatoria nueva, la ficha inactiva no debe aparecer.
6. En Jugadores inactivos abre la ficha, comprueba EA ID/dorsal/categoría y reincorpórala. Debe desaparecer de inactivos y volver al final de su categoría en Plantilla. Una nueva convocatoria la incluye sin responder; la creada mientras estaba inactiva no se altera.
7. En Supabase → Authentication → Users verifica que la cuenta vinculada sigue existiendo. En Table Editor puedes comprobar `players.is_active` y el mismo ID de ficha, sin editar filas manualmente.
8. Con una cuenta de jugador normal comprueba que no hay opciones de administración y que abrir `/inactive-players` o `/players/<id>` devuelve a Inicio. Las pruebas SQL locales comprueban además que RLS rechaza las actualizaciones directas.

No se ha recibido una URL del sitio para verificar este flujo en el Netlify publicado ni se han modificado datos remotos durante el desarrollo. La demo sigue separada y no guarda cambios. Permite abrir/cancelar la confirmación de la papelera, pero la confirmación de escritura está deshabilitada. La ficha y la papelera utilizan el mismo componente de confirmación y el mismo servicio.

## Verificaciones

Las pruebas PostgreSQL/PGlite cubren retirada, reincorporación, exclusión de convocatorias nuevas, snapshots y respuestas históricas íntegros, cuenta/membresía intactas, orden al reincorporar, reserva de EA ID/cuenta y permisos de jugador/otro club/anónimo. Las pruebas unitarias cubren los mensajes de error y los textos compartidos de confirmación. La comprobación de Chromium en móvil y escritorio cubre iconos SVG, áreas táctiles, adaptación de la fila, etiquetas accesibles, cancelación de la papelera y controles por rol sin peticiones Supabase.
