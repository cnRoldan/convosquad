# Recursos para Google Play

- `icon-512.png`: icono original de ConvoSquad adaptado a 512 × 512 px (PNG opaco, menos de 1 MB).
- `feature-graphic-1024x500.png`: gráfico de funciones en español, 1024 × 500 px (PNG opaco, menos de 15 MB).

El icono procede de `assets/images/icon.png`. El banner conserva la identidad verde y oscura de la app y se dirige a equipos de Clubes Pro. Estos archivos son recursos de la ficha de la tienda y no sustituyen el icono instalado de la aplicación.

## Capturas de teléfono

La carpeta `screenshots/` contiene cuatro PNG de 1080 × 1920 px (9:16), todos por debajo de 8 MB:

1. Selección de club.
2. Inicio del equipo.
3. Gestión de la plantilla.
4. Convocatoria y panel de voto.

Se han capturado desde la interfaz actual de la app exportada a web en una vista móvil, sin barras del navegador ni superposiciones publicitarias. La sesión, el club y los jugadores son datos de ejemplo interceptados localmente; no se han creado cuentas, votos ni convocatorias en producción. Las capturas muestran las pantallas tal como se renderizan y no son diseños de interfaces generados por IA.

## Capturas de tablets

- `tablet-7/`: cuatro capturas en 1080 × 1920 px, renderizadas en una vista de 720 × 1280.
- `tablet-10/`: cuatro capturas en 1440 × 2560 px, renderizadas en una vista de 900 × 1600.
- `tablet-7-capturas.zip` y `tablet-10-capturas.zip`: paquetes de descarga con los cuatro PNG de cada categoría.

Se mantienen la orientación vertical de la app y la proporción 9:16. Todas las imágenes pesan menos de 8 MB y las de 10 pulgadas superan 1080 px por lado. Comparten las mismas pantallas y los mismos datos de ejemplo de las capturas de teléfono, pero se renderizan nuevamente para cada tamaño de tablet; no se estiran las capturas del teléfono.

## Actualización de la ficha: 21 de noviembre de 2026

Se sustituyeron las cuatro capturas de teléfono de la ficha `es-ES` por las seis
imágenes de `refresh-20261121/`, en orden de nombre. Son PNG opacos de 1080 × 1920:
once publicado, editor del once, disponibilidad, plantilla, historial Prémium y
valoraciones. Las imágenes de tablet se conservan.

Se renderizó la interfaz actual exportada a web con fixtures locales, club Convo FC
y jugadores ficticios. El marco y los titulares son material promocional. La
captura de historial identifica Prémium como suscripción opcional; las valoraciones
individuales no se presentan como exclusivas de pago. No se modificaron datos de
producción ni se simularon compras.

La API de Google verificó los SHA-256 de las seis imágenes, validó el edit
`06257740908209460039` y aceptó el commit con `changesNotSentForReview=false`.
Este cambio afecta solo a las capturas de teléfono de la ficha española; la versión
1.1.0 (27) publicada y sus notas permanecen iguales. La aceptación del envío no
implica que la ficha pública ya haya terminado de actualizarse.
