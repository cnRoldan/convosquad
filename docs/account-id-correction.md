# Corrección del ID de acceso y nuevos idiomas

El usuario puede abrir **su ID → Cambiar mi ID de EA**, o usar el botón de
**Mis clubes**. Introduce el nuevo ID y la contraseña actual. Se aplican las
mismas reglas del registro: 3–24 letras ASCII, números, guiones o guiones bajos,
unicidad sin distinguir mayúsculas y eliminación de espacios exteriores.

`change_my_ea_id(current, new)` exige una autenticación por contraseña de menos
de cinco minutos comprobada en el JWT del servidor, valida que el ID anterior
siga vigente y modifica de forma atómica el correo técnico de Auth, la identidad
email, los metadatos y `profiles.username`. Elimina solicitudes de cambio de
correo pendientes. No acepta un UUID de destino, no permite cambiar cuentas
ajenas y conserva las cuentas antiguas que utilizan correo real/SSO.

La comprobación de contraseña usa un cliente efímero que ejecuta el RPC con su
JWT reciente. La sesión original se refresca después y la contraseña no se
persiste. Si se pierde la respuesta después de confirmar el cambio, se consulta
el estado real antes de anunciar un fallo. Un error al refrescar o cerrar la
sesión efímera no se presenta como una reversión de un ID ya guardado.

Se conserva el UUID y sus relaciones: clubes, miembros, votos, valoraciones y
fichas. Los nombres propios de las fichas y las fotografías históricas se
mantienen. La vinculación manual de una cuenta con nombre diferente a una ficha
ya existía y continúa protegida por el rol de capitán y el ámbito del club.

## Italiano y portugués de Portugal

Se incorporan `it` y `pt` a la app, el selector, las preferencias del perfil,
los avisos del servidor, las políticas y la página de descarga. Se reconocen
variantes regionales del dispositivo; portugués utiliza vocabulario y formatos
de Portugal. Los nombres aportados por usuarios no se traducen. Los catálogos
conservan las variables y los importes. El selector permite desplazamiento en
pantallas pequeñas. Los días portugueses usan `2.ª 3.ª 4.ª 5.ª 6.ª sáb dom` y
conservan los nombres completos para accesibilidad.

Los borradores de traducción se revisaron en los recorridos principales y los
textos de la landing y privacidad. Los modelos y herramientas auxiliares se
mantienen fuera del repositorio; la aplicación no descarga modelos ni llama a
servicios de traducción. La política aclara el tratamiento ya existente de
compras por Apple/Google y RevenueCat, sin cambiar el flujo de compra.

## Despliegue y validación del 28 de noviembre de 2026

Se aplicaron `20261128000100_italian_portuguese.sql` y
`20261128000200_change_my_ea_id.sql` y se desplegó `send-reminders` con los dos
idiomas, conservando su autenticación de worker. No se cambiaron cuentas ni
contraseñas de jugadores reales.

Validación: 221 pruebas unitarias, 15 pruebas SQL de cuentas, corrección de ID,
preferencias y eliminación; ocho recorridos de navegador de autenticación,
corrección, ID ocupado, selector con recarga y recurrencia en italiano y portugués;
TypeScript, lint y comprobación Deno del worker. Los fallos heredados de la suite
SQL completa constan en `release-1.1.1.md`; aquí se ejecutaron las regresiones de
las funciones afectadas.

Una cuenta ficticia creada para la prueba del servidor real confirmó guardado de
ambos idiomas, mismo UUID y preferencias tras la corrección, rechazo del acceso
con el ID anterior y acceso con el nuevo ID y la contraseña original. La cuenta
ficticia se eliminó usando la función normal de eliminación. Comprobante sin
credenciales: `/workspace/shared/convosquad-account-update/live-verification.json`.

La web puede ofrecer la corrección de inmediato a los usuarios móviles. El menú
y los idiomas de las apps instaladas requieren una compilación nativa posterior;
este cambio no sustituye ni reenvía automáticamente versiones de las tiendas.
