# ConvoSquad 1.1.1

Actualización autorizada el 27 de noviembre de 2026 para ambas tiendas.
Código compilado: `781c25de9deaa3a63336fe9ae93c1d0453457859`.

Incluye invitaciones HTTPS con acceso web y descargas, conservación de la
invitación durante autenticación, teléfonos pegados desde WhatsApp, convocatorias
semanales y avisos de notificaciones visibles solo para capitanes. No incluye
generación de alineaciones mediante IA.

## Compilaciones

| Plataforma | Versión | Compilación | EAS |
| --- | --- | --- | --- |
| Android | 1.1.1 | 28 | `7666959e-c027-4071-b592-2c920ea6bbb7` |
| iOS | 1.1.1 | 29 | `6f3bc91c-3280-44dd-9828-af0f6a5670c5` |

Ambas compilaciones terminaron correctamente. Se comprobaron los identificadores,
versiones y códigos en el manifiesto del AAB y en Info.plist del IPA, además de
la presencia de las invitaciones HTTPS y la recurrencia en los bundles nativos.

## Envíos confirmados

- Apple: `WAITING_FOR_REVIEW`, compilación 29 asociada, envío
  `51be89b4-875c-46ad-8eb0-1e50e3daa00d`, 27 de noviembre a las 18:35 UTC.
  EAS Submit `6af3fa41-c16c-4b49-b026-db7e0d745a9d` terminó correctamente.
- Google: compilación 28 cargada mediante EAS Submit
  `509edec4-39ec-4f4a-a01d-f1e361485b3f`, después promovida a `production` con
  notas en español, inglés, alemán y francés. Edit `09037408706181594404`
  validado y confirmado con `changesNotSentForReview=false`. Una lectura nueva
  confirma producción 1.1.1 (28), `status: completed`. Ese estado describe el
  despliegue solicitado y no demuestra que Google haya aprobado la revisión ni
  que la actualización esté disponible públicamente.

Los archivos y comprobantes están en
`/workspace/shared/ConvoSquad-1.1.1-release/`. SHA-256 de los binarios:

```text
Android AAB: b1815f64e41d615649122d0c330e42cd6d87d62a68ddf0a4f3844b88431e449d
iOS IPA:     9d32fb7d7ddcf9e147d045ed9d64ddb8adaa18d424569a05f67757d12ef77e24
```

La huella del AAB coincide con la que devuelve Google Play para la compilación 28.

El borrador de Apple `2b14655e-f75f-4865-946e-029779c1cdc3` se ha actualizado
a 1.1.1, con publicación después de aprobación. Conserva las doce capturas nuevas
y las credenciales de revisión. Las notas conservan los recorridos de compras y
añaden las funciones nuevas. Una carga a TestFlight no sustituye el envío de esta
versión a App Review.

Android debe enviarse al canal **production**. El perfil `store-production`
define ese canal explícitamente, sin cambiar el antiguo perfil de pruebas. Si se
usa `google-draft` para cargar el archivo, hace falta promover esa misma
compilación a producción y confirmar el edit con envío a revisión.

## Validación

TypeScript y lint correctos; 216 pruebas unitarias, cinco recorridos de navegador
de autenticación/invitación y diez pruebas de base de datos de recurrencia,
estado de notificaciones y teléfonos correctos. Las funciones correspondientes
ya existen en producción y el cron de recurrencia está activo.

La suite completa de base de datos obtiene 223 correctas y 42 fallidas. La
comparación aislada sin las dos migraciones del 22 de noviembre reproduce los
mismos 42 casos fallidos: 216 correctas y 42 fallidas. Los siete casos nuevos
pasan. Entre los fallos heredados hay fixtures sin activación/Prémium, nombres de
club repetidos y expectativas antiguas de notificaciones, colores y tipos
numéricos. No se presenta la suite completa como correcta. Logs y comparación
en `/workspace/shared/ConvoSquad-1.1.1-release/`.

No se ha realizado una prueba física de los binarios nuevos ni una compra
StoreKit/Google Play sandbox completa en esta sesión. La aprobación y la
disponibilidad pública de cada tienda deben verificarse aparte de la compilación
y de la carga del archivo.
