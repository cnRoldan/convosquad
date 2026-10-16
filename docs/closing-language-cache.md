# Cierre, idiomas y caché del escudo

## Cierre automático

Crear convocatoria incorpora un cierre automático, inicialmente a la hora del partido. Se puede cambiar o desactivar. El último aviso debe ir antes del cierre; el cierre debe ser del mismo día y anterior o igual al inicio. Las horas se interpretan en la zona IANA de la convocatoria, con horario de verano. Las horas inexistentes o ambiguas por cambio de horario se rechazan.

Administrar convocatoria → Modificar fecha y hora permite editar el cierre usando la zona guardada en esa convocatoria, aunque el club cambie de zona después. Para reabrir o reiniciar una convocatoria cuyo plazo terminó, primero hay que cambiar el cierre a una hora futura o desactivarlo.

La migración `20261017000100_call_up_closing_time.sql` añade `closes_at`, RPC atómicos de programación, validación de votos y una tarea Cron `convosquad-close-call-ups` cada minuto cuando pg_cron está instalado. La función privada bloquea clubes en el mismo orden que las operaciones existentes. Los votos se rechazan exactamente desde el límite mediante el reloj del servidor, también al responder desde una notificación. Cron materializa el estado cerrado en la siguiente ejecución; la pantalla oculta las acciones al vencer, sin depender de Realtime. Los avisos aún en cola se descartan si el plazo terminó. No se envía un aviso adicional de cierre.

Las convocatorias previas mantienen cierre nulo; no se reprograman ni se borran votos. Los RPC antiguos siguen existiendo para las APK anteriores. Si un servidor no tiene Cron, debe habilitarse y programarse `select private.close_due_call_ups()` como tarea de servidor: el bloqueo de votos funciona igualmente sin Cron.

## Idiomas

Se admite español, inglés, alemán y francés. La bandera junto al ID abre el selector sin una pantalla nueva. Se detecta el idioma del dispositivo/navegador; otros idiomas usan español. Se guarda la elección en el dispositivo y en el perfil mediante `set_preferred_language`, que solo modifica al usuario autenticado. Fechas y textos cambian de idioma; nombres y anotaciones se mantienen.

La migración `20261017000200_preferred_language.sql` añade la preferencia al perfil. El worker `send-reminders` consulta el idioma del destinatario y prepara los textos del push. Los identificadores de acciones y rutas no cambian. Hay que desplegar la versión actual del worker junto con la migración para traducir los avisos. Este despliegue no requiere cambiar secretos.

Los catálogos están en `src/features/i18n/locales`. Las claves son textos fuente españoles; las variables usan `{{v0}}`, `{{v1}}`, etc. Cada texto nuevo debe añadirse a los cuatro catálogos conservando las mismas variables. La base traducida se ha revisado en los términos principales de fútbol y navegación; conviene revisar la redacción con hablantes nativos antes de una distribución amplia. Las traducciones se incluyen en la app: no se solicita ningún servicio externo al usarla.

## Escudos

Las URLs firmadas se comparten entre componentes y pantallas, separadas por usuario. Las peticiones simultáneas se deduplican y los errores no se cachean. La URL se renueva al caducar a los 55 minutos, antes de su expiración de una hora. Se conservan hasta 30 entradas en memoria. `expo-image` reutiliza la imagen en memoria/disco; volver a una pantalla no fuerza una descarga ni una nueva firma.

Guardar o quitar un escudo invalida su URL en todos los componentes de la sesión. El reemplazo obtiene una URL con versión distinta para evitar mostrar el archivo antiguo. Cerrar sesión limpia la caché de URLs. Una petición antigua no puede repoblarla después de invalidar o cerrar sesión.

## Verificación

Pruebas SQL locales: creación y edición atómicas, permisos, votos por app/push tras el plazo, reinicio rechazado sin borrar votos, cierre idempotente y preferencias de idioma. Pruebas unitarias: zonas horarias, cambios estacionales, variables de traducción, avisos por destinatario y caché. Navegador: selector y persistencia, nombres sin traducir, cierre sin Cron/Realtime y reutilización del escudo al navegar y cambiar idioma.

Una nueva APK es necesaria para comprobar los nuevos módulos nativos y los avisos traducidos en un móvil físico. Compilar o exportar web no valida la entrega push real.
