# Invitaciones públicas y acceso sin instalación

La pantalla de invitaciones comparte siempre HTTPS. Si no se configura
`EXPO_PUBLIC_INVITE_BASE_URL`, el origen es `https://convosquad.com`, tanto en web
como en iOS y Android. Una configuración explícita sigue exigiendo un origen HTTPS
sin ruta, credenciales, query ni fragmento. El esquema `convosquad:///invite` queda
para el botón explícito «Abrir invitación en la app», no para compartir en WhatsApp.

El enlace público usa `/invite?club=UUID#token=TOKEN`. El token se mantiene en el
fragmento, fuera de peticiones HTTP y cabeceras Referer. Se añade Referrer-Policy
no-referrer y Cache-Control no-store a la ruta. No se crean, canjean ni consumen
invitaciones al obtener una vista previa del enlace: la incorporación requiere la
cuenta y la acción explícita de aceptar. Se conservan caducidad, usos y revocación.

La página ofrece continuar o crear cuenta en el navegador, abrir la app instalada
y descargar desde ambas tiendas. Los enlaces a las tiendas no contienen el token.
Tras instalar, se debe volver al mensaje y abrir de nuevo la invitación: no se
promete una transferencia automática del contexto desde App Store o Google Play.
No se han añadido Universal Links ni Android App Links sin configurar sus asociaciones.

En navegador, la invitación pendiente se conserva en sessionStorage de la pestaña
para tolerar recargas durante login o registro; se valida su formato y una antigüedad
máxima de 30 días. Se elimina al aceptar, cancelar o cerrar sesión correctamente.
El contexto no bloquea el acceso si el navegador prohíbe el almacenamiento. En nativo
sigue en memoria; el enlace original permite reanudar la incorporación.

Los textos y metadatos genéricos de la invitación están traducidos a español,
inglés, alemán y francés. La vista previa no publica el token ni datos privados del
club. La aceptación permanece en el backend con las comprobaciones existentes.

Verificación: generación HTTPS por defecto y con origen alternativo, handoff nativo,
fragmentos y parámetros inválidos, restauración del almacenamiento; interfaz con
compartición a WhatsApp interceptada, login y registro tras recarga y rechazo de una
invitación caducada, sin incorporar usuarios reales. TypeScript y lint.

Los móviles ya instalados seguirán generando el enlace antiguo hasta actualizarse.
Mientras tanto se puede generar y compartir desde la versión web. Esta corrección
no cambia los enlaces ya enviados ni los convierte automáticamente en HTTPS.
