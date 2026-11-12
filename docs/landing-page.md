# Página para compartir ConvoSquad

Dirección pública: **https://convosquad.netlify.app/descargar/**.

La landing es HTML y CSS estáticos en `public/descargar/`. Expo copia esta carpeta
al exportar la web y Netlify sirve su `index.html`. No necesita sesión, Supabase,
ni JavaScript para leer el contenido ni una compilación móvil nueva. El acceso a la
aplicación web se mantiene en `/`, con registro, privacidad y eliminación de cuenta
en sus rutas habituales.

## Enlaces de las tiendas

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
