# Imagen del once: campo y carga del escudo

La exportación utiliza un lienzo vertical de 1324 × 1740. La cabecera ocupa 180 píxeles y el fondo recorta el cielo y parte de las gradas; la zona útil de campo ocupa más del 70 % de la altura. Frente al cartel de 1324 × 1550, se aumenta el tamaño máximo de camisetas, dorsales y nombres un 16 %, con más espacio vertical de campo para mantener la separación. Las formaciones más densas ajustan uniformemente el tamaño según el espacio disponible.

`poster-geometry.ts` comparte dimensiones entre SVG, vista nativa y PNG web. Proyecta las coordenadas de la pizarra sobre el campo en perspectiva, haciendo coincidir su profundidad 0,5 con la línea de medio campo del fondo. Las coordenadas guardadas de la alineación no cambian. `poster-layout.ts` mantiene una escala común a todo el equipo y comprueba separación entre camisetas y nombres; las posiciones coincidentes intencionadamente conservan el tamaño mínimo legible.

Las camisetas y los dorsales tienen una ampliación adicional del 15 % respecto a los nombres. Sus límites incluyen el trazo del SVG para que el cálculo de separación contemple el nuevo tamaño.

La preparación del escudo termina antes de montar la vista que se captura. En nativo, `poster-readiness.ts` espera el layout y los eventos de carga del fondo, escudo y marca. Después deja dos fotogramas para el dibujo antes de `captureRef`. Una imagen que no termina de cargar cancela la captura tras 15 segundos en lugar de exportar un recuadro vacío. Los callbacks están ligados a la captura concreta, para que un evento antiguo no complete otra captura.

En web se espera el layout y el exportador incrusta las imágenes en el SVG y utiliza `Image.decode()` antes de dibujar el PNG. La vista capturada no añade márgenes exteriores y conserva la misma relación de aspecto que el SVG.

Validación: pruebas unitarias de geometría, uniformidad, separación para todas las formaciones y orden/timeout de carga; exportación real en navegador con y sin escudo, comprobando dimensiones y píxeles dentro de la zona del escudo. La captura nativa necesita una prueba física en iOS en la siguiente compilación; no se ha verificado en dispositivo durante este cambio.
