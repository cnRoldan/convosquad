# Estado de pagos: 3 de noviembre de 2026

Comprobación de las tiendas y la configuración remota:

- App Store Connect tiene creadas las suscripciones `com.convosquad.premium.monthly` y `com.convosquad.premium.yearly`. Ambas están en `MISSING_METADATA`. El producto de activación `com.convosquad.club.activation` también está en `MISSING_METADATA` y es de tipo `NON_CONSUMABLE`.
- RevenueCat devuelve para iOS el offering `premium` con paquetes mensual y anual y `club_activation` con el paquete de activación.
- EAS production tiene la clave pública de RevenueCat para iOS; no tiene `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
- El webhook de RevenueCat está desplegado en Supabase y el secreto está configurado. No hay transacciones registradas en `club_store_purchases`. Esto no demuestra por sí solo que una compra completa funcione.
- Google Play devuelve una lista vacía (HTTP 204) al consultar suscripciones. El cálculo de precios regionales devuelve `FAILED_PRECONDITION`; todavía no se han creado ni activado productos de Google desde esta comprobación.
- El propietario indica que el siguiente paso pendiente era validar el JSON de la cuenta de servicio en la aplicación de Google Play dentro de RevenueCat. Falta localizar esa pantalla y comprobar el resultado. El JSON es privado; no debe copiarse al chat ni al repositorio.

Se corrigió un fallo compartido del cliente que devolvía un catálogo vacío al volver a consultar ofertas para el mismo usuario. El SDK ahora se configura una vez, usa `logIn` al cambiar de cuenta y serializa sus operaciones para no cambiar el comprador durante una compra pendiente. Una cancelación o error permite reintentar. Las pruebas de esta sesión de compras pasan.

Pendiente antes de cerrar Google: credenciales verificadas en RevenueCat, clave pública del SDK de Android en EAS, productos y planes base, asociación a los offerings, tratamiento de identificadores `productId:basePlanId` en el servidor, precios localizados de la tienda, confirmación del acceso Prémium y compra de prueba completa. Apple requiere completar sus metadatos y validar el mismo recorrido; tener los productos creados y la app en TestFlight no equivale a tener los pagos listos.
