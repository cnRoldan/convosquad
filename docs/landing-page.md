# Página para compartir ConvoSquad

Dirección pública: **https://convosquad.netlify.app/descargar/**.

La landing es HTML y CSS estáticos en `public/descargar/`. Expo copia esta carpeta
al exportar la web y Netlify sirve su `index.html`. No necesita sesión, Supabase,
ni JavaScript para leer el contenido ni una compilación móvil nueva. El acceso a la
aplicación web se mantiene en `/`, con registro, privacidad y eliminación de cuenta
en sus rutas habituales.

## Enlaces de las tiendas

Google Play está publicado y el botón enlaza a
`https://play.google.com/store/apps/details?id=com.convosquad.app`. El enlace
funciona también con JavaScript desactivado. Desde el 27 de noviembre de 2026,
App Store está verificada en España y su botón enlaza a
`https://apps.apple.com/es/app/convosquad/id6824663674`. Ambos botones están activos.


En `public/descargar/stores.js`, sustituir el `null` de `apple` o `google` por la
URL HTTPS pública y verificada de su ficha. Hacerlo para cada tienda cuando su
aplicación esté publicada; no apuntar a TestFlight ni a pruebas cerradas. El script
activa su enlace y actualiza los avisos de disponibilidad. Solo admite los hosts
oficiales `apps.apple.com` y `play.google.com`. Mientras los valores sean `null`,
las dos opciones indican Próximamente y no envían al usuario a fichas inexistentes.

## Precios y contenido

Los importes de referencia actuales para España son: prueba inicial de 10 días
para el primer club de cada cuenta, activación permanente 2,99 €, Prémium mensual
0,99 € o anual 9,99 €. Las compras son para el club y las realiza un capitán.
La activación y la suscripción se explican por separado. Prémium permite crear
convocatorias mientras esté activo sin exigir la compra de activación por separado.
El precio definitivo es el mostrado por la tienda. Revisar esta sección si cambian
los productos, importes o límites de funciones; no se consulta un catálogo remoto.

Las capturas PNG proceden de las pantallas actuales de plantilla, convocatoria y
alineación publicada, ejecutadas en Chromium a 390×844 con escala 2. Utilizan un
club ficticio Convo FC y jugadores de ejemplo mediante los fixtures locales de la
aplicación. No muestran teléfonos, contraseñas ni clubes reales. Actualizarlas si
cambia la interfaz. `media/compartir.png` es la vista previa de 1200×630 para enlaces
compartidos en WhatsApp y redes sociales.

## Verificación

Comprobar la exportación web y servir `dist/` con soporte para directorios index.
Revisar `/descargar/` a 320, 390, 768 y 1440 px: ausencia de desplazamiento horizontal,
imágenes cargadas, navegación interna, preguntas desplegables y enlaces a la app.
Verificar también el estado de las tiendas con ambos enlaces pendientes y con una
sola tienda publicada. La página sigue siendo legible con JavaScript desactivado.

## Idiomas de la landing

La landing admite los mismos idiomas que la app: español, inglés, alemán y francés.
`language.js` conserva el HTML español como alternativa sin JavaScript y carga los
diccionarios de `locales/` para los demás idiomas. El selector del encabezado permite
cambiar de idioma sin perder enlaces, iconos ni desplegables.

Prioridad inicial: parámetro `?lang=es|en|de|fr`, preferencia guardada en
`convosquad.landing.language`, primer idioma compatible del navegador y español
como alternativa. La selección manual guarda la preferencia y actualiza `?lang=`
para compartir el enlace. Si el almacenamiento está bloqueado o falla la descarga
del diccionario, la página y el enlace de Google Play siguen utilizables.

También se traducen los textos de disponibilidad de tiendas, título, descripción,
etiquetas accesibles y textos alternativos. `stores.js` exporta `renderStores` y
recibe la función de traducción: cualquier cambio de disponibilidad se refleja en
el idioma seleccionado. Las capturas y la imagen social siguen en español; el pie
de las capturas lo indica en las traducciones. Los precios siguen siendo referencias
para España en euros, sin inferir precios de otros países a partir del idioma.

Verificación en Chromium: los cuatro idiomas a 320, 390, 768 y 1440 px, sin desborde
horizontal; detección del navegador, selector, persistencia tras recarga, prioridad
del enlace compartido, vuelta al español, almacenamiento bloqueado, error al cargar
traducciones, enlaces y alternativa sin JavaScript.
