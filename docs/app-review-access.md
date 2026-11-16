# Acceso de App Review

## Actualización del 16 de noviembre de 2026: compras localizables en la compilación 28

El envío `60fcf464-cc54-463e-b9c2-0f2093ea8f39` se reenvió por petición
expresa del usuario el 16 de noviembre de 2026 a las 21:35 UTC. Apple confirmó
`WAITING_FOR_REVIEW` con los cinco elementos en `READY_FOR_REVIEW` y la compilación
28 vinculada. Se añadieron a las notas de App Review los recorridos de compra y
la restricción de storefront español, conservando las credenciales y las notas
anteriores. No se envió un mensaje separado en la conversación con el revisor.

El club original **ConvoSquad App Review** conserva la activación y Prémium manuales
para revisar todas las funciones. Esas concesiones ocultan los accesos naturales
a la activación y al paywall histórico; no usarlo para localizar las compras.

Se ha añadido un segundo club privado y ficticio, **ConvoSquad App Review - Purchases**,
a las mismas tres cuentas de revisión. AppleTester y AppleReviewCaptain son
capitanes; AppleReviewPlayer conserva el rol de jugador. Contiene 14 fichas y una
convocatoria finalizada del 15 de noviembre de 2026 con alineación publicada.
No tiene activación ni Prémium manuales y no se han creado transacciones falsas.

Recorridos en la compilación existente:

1. Iniciar sesión con AppleTester y las credenciales existentes de App Review.
   Si entra directamente en el club original, usar Inicio → Cambiar de club y
   seleccionar **ConvoSquad App Review - Purchases**.
2. **Activación, antes de suscribirse:** Inicio → Editar información → desplazarse
   a Activa tu club → Activar club. Con Prémium activo, el backend también considera
   activado el club, por lo que el panel de activación deja de mostrarse.
3. **Mensual/anual:** Inicio → Historial de convocatorias → Consultar alineación
   en la convocatoria finalizada → Activar Prémium. Se muestran las dos opciones.
   Este acceso no requiere agotar las seis generaciones gratuitas del mes.

Se comprobó en App Store Connect que las suscripciones tienen 175 territorios,
incluidos España y EE. UU. La activación permanente solo tiene España. Para revisar
los tres productos con la configuración actual, indicar un storefront sandbox de
España; cambiar el idioma o la región del dispositivo no equivale a cambiar el
storefront de la cuenta. No se ha ampliado la disponibilidad comercial.

Validación: transacción de preparación ensayada con rollback, autenticación real
con las credenciales vigentes guardadas en App Store Connect, membresía de capitán,
activación=false, premium=false, historial visible y read_historical_lineup con
allowed=false para mostrar el acceso a Prémium. Se verificó que el Prémium original
sigue activo. Esta comprobación no ejecutó compras en StoreKit ni valida una
transacción sandbox nativa completa. Falta confirmar el acuerdo de Apps de pago
con el titular de la cuenta y probar los botones en el dispositivo con la build 28.

## Preparación histórica del 8 de noviembre de 2026

En esa fecha, el envío `6ebca65d-fc81-4cbc-bd1f-1cc0adcc52a0` estaba en `UNRESOLVED_ISSUES`. La versión de App Store `1.0.0` estaba rechazada y seguía asociada a la compilación **13**. Antes de reenviar, comprobar qué binario se quiere publicar: subir versiones a TestFlight no cambia este vínculo.

Se verificó que la cuenta configurada en App Review Information, `AppleTester`, podía autenticarse con la contraseña existente, pero no tenía membresía en ningún club. `AppleTester2` era una cuenta distinta con un club incompleto; no era la credencial principal del envío.

Se preparó un club privado y ficticio, **ConvoSquad App Review**, con `AppleTester` como propietario y capitán. El club incluye 14 fichas, una convocatoria abierta futura, dos convocatorias terminadas, alineaciones publicadas, un borrador editable, notas de jugadores, una prueba y una ayuda. La activación y Prémium están habilitados manualmente en este club de revisión: no se han creado compras ni transacciones de tienda ficticias.

También hay cuentas independientes `AppleReviewCaptain` (segundo capitán, para probar flujos entre capitanes) y `AppleReviewPlayer` (jugador). Las tres cuentas tienen ficha vinculada. Las cuentas y los datos de los clubes reales se conservan.

Las credenciales y las notas detalladas están en un archivo privado del espacio compartido, fuera del repositorio. La contraseña de `AppleTester` no se ha cambiado. No copiar contraseñas, sesiones, tokens ni datos de contacto a este documento o al código.

Pasos de acceso: cerrar una sesión restaurada, usar **Iniciar sesión**, introducir el ID de EA y la contraseña, seleccionar **ConvoSquad App Review** y pulsar **Entrar al club**. El modo **Explorar la demo** es de solo lectura y no sustituye estas cuentas funcionales. Las restricciones por rol y los plazos normales de valoración permanecen activos.

El calendario de revisión usa fechas de ejemplo: mantener una convocatoria futura disponible si la revisión supera el mes de preparación. Las valoraciones históricas están pobladas, pero editar notas sigue limitado al plazo normal de 24 horas. Este contenido no añade funciones que no existan en un binario antiguo.

La preparación no ha enviado mensajes al revisor, modificado las notas de App Review ni reenviado la compilación 13. Las instrucciones y la respuesta están listas para el próximo envío.

Validación: autenticación real con las tres credenciales, acceso del propietario/capitán y del jugador por RPC y RLS, ficha vinculada, convocatoria futura, histórico con notas, imagen publicada e indicaciones. En navegador se verificaron los tres recorridos desde el formulario de acceso hasta convocatoria y alineación, con una exportación de `main` y tamaño de iPad de 834 × 1194. Con un solo club, la app puede entrar directamente a Inicio después del login. Esto no es una prueba física de la compilación nativa 13.
