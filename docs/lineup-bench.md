# Selección múltiple para el banquillo

«Añadir al banquillo» permite marcar y desmarcar jugadores y confirmar con «Añadir seleccionados (n)». Cambiar de categoría conserva la selección, incluso si algunos elegidos quedan ocultos por el filtro. Cerrar descarta lo pendiente; no modifica la alineación hasta confirmar.

El editor incorpora todo el grupo en una sola modificación, sin duplicar jugadores ni incluir titulares. Conserva las inclusiones manuales y retira únicamente las exclusiones de los elegidos. Deshacer revierte el grupo completo. Guardar borrador utiliza el mismo guardado existente.

Los formularios de ayuda/prueba conservan la selección al volver. Si se crea una ayuda o prueba con jugadores pendientes, el formulario avisa y se incorporan también junto al nuevo jugador. Los errores de creación mantienen el formulario y la selección.

Validación: tres pruebas de interfaz para selección entre filtros, desmarcado, confirmación/guardado, cancelación, deshacer y creación de ayuda con jugadores pendientes. Pasan 203 pruebas unitarias, TypeScript y lint. No requiere cambios de servidor; la interfaz nativa necesita una nueva compilación.
