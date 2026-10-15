# Registro y acceso con ID de EA

Las nuevas cuentas utilizan únicamente **ID de EA + contraseña**, sin correo, confirmación ni recuperación automática. Si un ID está ocupado o se pierde una contraseña, el usuario contacta con el administrador. La aplicación no verifica la propiedad del ID en EA ni elimina cuentas automáticamente.

## Activación en Supabase desde el navegador

1. Abre el proyecto correcto en Supabase y su **SQL Editor**. Ejecuta una sola vez el contenido de `supabase/migrations/20261015180000_ea_id_auth.sql`. No repitas las migraciones anteriores ni `supabase/setup/initial-setup.sql`.
2. En **Authentication → Sign In / Providers → Email**, mantén Email/Password habilitado y desactiva **Confirm email**. Mantén habilitadas las nuevas altas en la configuración de Auth. Guarda los cambios. Este ajuste afecta a todas las nuevas altas con contraseña del proyecto; no elimina cuentas ni confirma retrospectivamente las existentes.
3. En Codex ejecuta `npm run auth:check`. Consulta únicamente los ajustes públicos de Auth y una respuesta booleana del RPC. No registra usuarios ni modifica datos. Ambas comprobaciones deben pasar antes de probar un registro real.
4. Despliega la web desde GitHub/Netlify y genera la APK con el perfil `preview` de EAS. Las variables públicas y el archivo Firebase existentes siguen siendo válidos; no hacen falta nuevos secretos.

La migración permite guiones en `profiles.username`, que actúa como ID de EA en las nuevas cuentas; conserva los valores existentes. El índice único de `lower(username)` impide duplicados incluso ante altas simultáneas. Las entradas se recortan y se admiten de 3 a 24 letras ASCII, números, guiones y guiones bajos. Un RPC accesible a visitantes responde solo si el ID está disponible, sin devolver perfiles, correos, UUID ni membresías. Se retira la edición directa del identificador por los clientes para evitar que deje de coincidir con el acceso.

El SQL está en una transacción. No elimina datos, no modifica RLS ni las funciones de clubes y no se aplica automáticamente durante builds o despliegues. La eliminación de la restricción antigua se utiliza únicamente para ampliarla y sustituirla dentro de esa transacción.

## Cómo funciona Auth

Supabase Auth sigue gestionando contraseñas, sesiones, renovación, límites de acceso y cierre de sesión. El cliente transforma el ID recortado y en minúsculas en `ea.<id>@accounts.convosquad.invalid`, un identificador técnico determinista bajo un dominio reservado que no recibe correo. No es un correo solicitado al usuario ni una identidad verificada por EA. No se implementa un almacén propio de contraseñas ni se incluye `service_role` en la app.

Antes de dar de alta, la app comprueba que Auth no exige correo y que el RPC existe. Si falta configuración, muestra un aviso y no intenta registrar. Comprueba disponibilidad antes del alta, y PostgreSQL decide la unicidad definitiva. Solo anuncia éxito con una sesión real. El perfil se crea mediante el trigger existente de Auth; no se asigna ningún club, ficha o rol automáticamente.

Las contraseñas requieren al menos ocho caracteres. Se conservan los límites de Supabase Auth; no se llama a la API administrativa para evitarlos. Para protección adicional frente a altas abusivas, Supabase permite configurar CAPTCHA; activarlo requiere integrar su desafío en el formulario.

## Soporte y cuentas de desarrollo

El formulario solo admite ID de EA y contraseña. Se ha retirado la compatibilidad de acceso y recuperación por correo, incluidos los formularios de las rutas antiguas. Las cuentas de desarrollo previas no se eliminan ni convierten automáticamente: si se quiere conservar el club de una cuenta antigua, soporte debe adaptar su identificador de Auth y su perfil al ID de EA elegido, conservando el mismo UUID. Crear otra cuenta no transfiere clubes ni permisos.

Las cuentas nuevas muestran que deben contactar con el administrador si olvidan la contraseña o su ID está ocupado. No se enviarán recuperaciones a los identificadores internos. No añadas contraseñas, correos técnicos ni detalles de sesión a logs o tickets. Antes de eliminar una cuenta en Authentication → Users, revisa sus clubes: una cuenta que sea el último administrador requiere transferir antes ese rol. El soporte y las eliminaciones son manuales, nunca parte del formulario de registro.

## Prueba manual

Con la activación completada, abre `/register` en Netlify o instala la nueva APK. Introduce un ID nuevo y una contraseña: debe entrar en la selección de club directamente, y aparecer el perfil en Supabase. Cierra sesión y entra usando el mismo ID con otras mayúsculas. Intenta registrar el ID ya ocupado desde otra sesión: debe rechazarse. Usa cuentas de prueba autorizadas; los tests automatizados interceptan Auth o usan PostgreSQL local y no crean usuarios remotos.

Una build móvil incluye el código en su APK: instalar una APK anterior no incorpora esta modificación. Las credenciales Android existentes se reutilizan con:

```sh
npm run eas -- build --platform android --profile preview --non-interactive --freeze-credentials --no-wait
```
