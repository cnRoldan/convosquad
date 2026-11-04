# Publicación: comprobación del 4 de noviembre de 2026

## Estado comprobado

- App Store Connect: versión de producción `1.0.0`, id `403b5a72-54d3-40b3-9a22-4a9694ec31ca`, en `WAITING_FOR_REVIEW`. Tiene asociada la **compilación 13**, subida el 24 de octubre, y `releaseType=AFTER_APPROVAL`. Aprobar este envío publicaría esa compilación antigua, no la 22.
- Revisión de Apple pendiente: `6ebca65d-fc81-4cbc-bd1f-1cc0adcc52a0`, enviada el 2 de noviembre. No se ha retirado ni modificado durante esta comprobación.
- La compilación iOS 22 de la versión `1.1.0` está subida y procesada (`VALID`). EAS confirma compilación y envío `FINISHED` para iOS 22 y Android 23. Esto no demuestra que los pagos funcionen.
- Activación permanente de club en Apple: `MISSING_METADATA`. Se han configurado localización española y disponibilidad en España; falta la captura de revisión.
- Suscripciones mensual y anual en Apple: ambas en `MISSING_METADATA`.
- Google: el propietario confirmó activación de los planes, asociación en RevenueCat y alta de testers con licencia. En la última captura del panel de producción todavía debía completar la prueba cerrada de 14 días con al menos 12 testers. El contador y la elegibilidad actuales no se han verificado; no se debe dar una fecha de producción basándose en aquella captura.

## Cierre de lanzamiento

1. Completar productos de pago en ambas tiendas, incluida activación de club en Android, que aún no figura en su catálogo de RevenueCat en la última comprobación.
2. Verificar en dispositivo compra, activación del club correcto, suscripción, restauración y caducidad. Las pruebas automatizadas del servidor no sustituyen este recorrido.
3. Revisar el modelo de compra de varios clubes: el producto actual de activación de Apple es no consumible; no permite comprar el mismo producto repetidamente para otros clubes. No cambiar el tipo ni reasignar compras existentes sin concretar ese comportamiento.
4. Preparar una compilación final con los avisos de prueba y errores de compra añadidos después de iOS 22/Android 23.
5. Revisar ficha, privacidad y acceso del revisor para esa versión. Resolver el envío antiguo de Apple y asociar la versión final antes de volver a revisión; no confundir nuevas cargas a TestFlight con actualizar el envío de producción.
6. Confirmar acceso a producción de Google en su panel y presentar el lanzamiento cuando esté habilitado.

El lanzamiento no está cerrado mientras falten estos puntos. No se ha cancelado la revisión de Apple ni publicado una versión nueva como parte de esta inspección.
