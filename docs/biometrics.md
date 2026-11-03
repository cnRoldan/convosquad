# Acceso biométrico

La opción está en el menú del ID de EA → Acceso biométrico, en iOS y Android.
Se activa de forma voluntaria y por cuenta/dispositivo, tras una confirmación del sistema.
El primer acceso sigue usando ID de EA y contraseña. No se guardan contraseñas.

La app se bloquea al recuperar una sesión con la opción activa y al volver después
de 30 segundos en segundo plano. Mientras está inactiva se oculta su contenido.
El diálogo del sistema no reinicia el temporizador ni abre diálogos simultáneos.
Cancelar o fallar mantiene el bloqueo y permite reintentar. Se admite el código del
dispositivo como alternativa del sistema, cuando este lo ofrezca. En Android se
solicita biometría fuerte. La opción de entrar con contraseña cierra la sesión y
borra la preferencia biométrica de esa cuenta en este dispositivo.

Las sesiones nativas de Supabase se guardan en SecureStore. La migración desde
AsyncStorage escribe primero la copia segura y elimina después la copia anterior.
Las sesiones largas se dividen en bloques de hasta 450 caracteres Unicode para
respetar el límite de tamaño por valor. Un manifiesto apunta a la generación completa;
una escritura fallida no sustituye la sesión anterior. La web mantiene su almacenamiento
habitual y no ofrece el bloqueo biométrico nativo.

Se necesitan nuevas compilaciones nativas: se han añadido expo-local-authentication,
expo-secure-store y el permiso de uso de Face ID. La exportación JS no prueba sensores
físicos. Antes de distribuir hay que comprobar en dispositivos iOS y Android:

- Actualizar una instalación con sesión previa, sin tener que iniciar sesión otra vez.
- Activar y desactivar, cancelar el diálogo y reintentarlo.
- Cerrar la app y abrirla; volver antes y después de 30 segundos.
- Abrir una notificación y volver desde compartir una imagen con el bloqueo activo.
- Cerrar sesión, cambiar de cuenta y entrar con contraseña si la biometría falla.
- Simular pérdida de conectividad y ausencia/cambio de biometría registrada.

Las pruebas automatizadas cubren la máquina de estados, las respuestas tardías de
otra cuenta, los diálogos simultáneos y la migración/escritura/borrado de sesiones.
