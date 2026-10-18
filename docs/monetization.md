# Modelo de monetización acordado

Decisión del propietario, 19 de octubre de 2026:

- Crear **cada club**: pago único de **2,99 €**.
- Pertenecer a un club, votar y ejercer de capitán: gratis.
- Los clubes existentes se conservan sin cargo retroactivo.
- En una fase posterior: funciones adicionales mediante suscripción de **0,99 €/mes**.
  Todavía no están definidas ni deben bloquearse funciones por esa futura suscripción.

## Siguiente implementación

La creación de un club en las apps móviles desbloquea un servicio digital y se
integrará con compras de Apple y Google. Cada compra dará un crédito de creación:
no es un desbloqueo permanente de todos los clubes. El producto debe permitir
compras repetidas (consumible en Apple y producto consumible mediante Google Play
Billing). El precio mostrado en la app será el precio localizado de la tienda;
2,99 € es el precio objetivo en euros, no un precio fijo en todos los países.

Antes de habilitar cobros se necesitan cuentas de tienda activadas, acuerdos de
pago y datos fiscales/bancarios, fichas de la app, productos, credenciales de
verificación de compras y dispositivos de prueba. No se introducirán cobros
simulados ni botones que anuncien un pago completado sin validación del servidor.

El servidor deberá validar transacciones y procesarlas con idempotencia,
asignarlas al usuario autenticado y consumir exactamente un crédito al crear
el club en una transacción. Cancelaciones, compras pendientes y fallos de red
no deben crear clubes ni perder créditos. Si una compra se confirma pero falla
la creación, el crédito seguirá disponible. Los clubes adquiridos seguirán
accesibles desde Android, iOS y web a través de la cuenta, sin cobrar por acceder.

La verificación debe cerrar también el RPC `create_club` y las rutas alternativas
para que no se pueda omitir el pago llamando directamente a Supabase. El flujo
web de nuevas compras y la gestión de devoluciones quedan pendientes de concretar.
Los consumibles requieren un registro propio de transacciones/créditos: no basta
con un botón genérico de restaurar compras de la tienda.

El cobro todavía no está habilitado. Este documento registra el alcance acordado;
no constituye una integración de pagos ni modifica los clubes actuales.
