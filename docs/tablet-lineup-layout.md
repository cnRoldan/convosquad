# Alineación en pantallas amplias

La pantalla de alineación utiliza la variante `wide` de `Screen`, con un ancho máximo de 1200 puntos. Desde 800 puntos de ventana distribuye el campo y un panel lateral de 280 puntos en dos columnas. El panel agrupa banquillo, incidencias y acciones. Por debajo de ese tamaño se presenta en una columna.

El campo calcula su altura a partir del ancho medido, entre 520 y 960 puntos. Tanto las camisetas como el arrastre utilizan las dimensiones actuales del campo y mantienen coordenadas normalizadas; redimensionar la ventana no modifica el borrador. Un arrastre no debe abrir el selector al soltar; la siguiente pulsación sí lo abre.

La prueba visual recorre los tamaños 1032 × 1376 y 912 × 1368 de las capturas del usuario, cambia a 390 × 844, comprueba ancho, altura, columnas y ausencia de desbordamiento horizontal, mueve un jugador y verifica que se conservan los cambios al redimensionar. Esta comprobación se realiza en navegador; no equivale a una validación en tablet física.
