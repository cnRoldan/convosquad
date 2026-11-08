# Acceso de App Review: 8 de noviembre de 2026

El envío `6ebca65d-fc81-4cbc-bd1f-1cc0adcc52a0` está en `UNRESOLVED_ISSUES`. La versión de App Store `1.0.0` está rechazada y sigue asociada a la compilación **13**. Antes de reenviar, comprobar qué binario se quiere publicar: subir versiones a TestFlight no cambia este vínculo.

Se verificó que la cuenta configurada en App Review Information, `AppleTester`, podía autenticarse con la contraseña existente, pero no tenía membresía en ningún club. `AppleTester2` era una cuenta distinta con un club incompleto; no era la credencial principal del envío.

Se preparó un club privado y ficticio, **ConvoSquad App Review**, con `AppleTester` como propietario y capitán. El club incluye 14 fichas, una convocatoria abierta futura, dos convocatorias terminadas, alineaciones publicadas, un borrador editable, notas de jugadores, una prueba y una ayuda. La activación y Prémium están habilitados manualmente en este club de revisión: no se han creado compras ni transacciones de tienda ficticias.

También hay cuentas independientes `AppleReviewCaptain` (segundo capitán, para probar flujos entre capitanes) y `AppleReviewPlayer` (jugador). Las tres cuentas tienen ficha vinculada. Las cuentas y los datos de los clubes reales se conservan.

Las credenciales y las notas detalladas están en un archivo privado del espacio compartido, fuera del repositorio. La contraseña de `AppleTester` no se ha cambiado. No copiar contraseñas, sesiones, tokens ni datos de contacto a este documento o al código.

Pasos de acceso: cerrar una sesión restaurada, usar **Iniciar sesión**, introducir el ID de EA y la contraseña, seleccionar **ConvoSquad App Review** y pulsar **Entrar al club**. El modo **Explorar la demo** es de solo lectura y no sustituye estas cuentas funcionales. Las restricciones por rol y los plazos normales de valoración permanecen activos.

El calendario de revisión usa fechas de ejemplo: mantener una convocatoria futura disponible si la revisión supera el mes de preparación. Las valoraciones históricas están pobladas, pero editar notas sigue limitado al plazo normal de 24 horas. Este contenido no añade funciones que no existan en un binario antiguo.

La preparación no ha enviado mensajes al revisor, modificado las notas de App Review ni reenviado la compilación 13. Las instrucciones y la respuesta están listas para el próximo envío.

Validación: autenticación real con las tres credenciales, acceso del propietario/capitán y del jugador por RPC y RLS, ficha vinculada, convocatoria futura, histórico con notas, imagen publicada e indicaciones. En navegador se verificaron los tres recorridos desde el formulario de acceso hasta convocatoria y alineación, con una exportación de `main` y tamaño de iPad de 834 × 1194. Con un solo club, la app puede entrar directamente a Inicio después del login. Esto no es una prueba física de la compilación nativa 13.
