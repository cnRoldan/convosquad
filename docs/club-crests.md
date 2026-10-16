# Escudos de clubes

En Crear club se puede elegir una imagen de la galería y revisar su vista previa. El escudo es opcional. Para clubes existentes, un capitán puede usar Editar información → Escudo del club para añadirlo, cambiarlo o quitarlo.

El selector admite imágenes de la biblioteca. Los formatos que el dispositivo/navegador pueda decodificar se convierten a PNG, conservando proporciones y transparencia y limitando el lado mayor a 512 píxeles. PNG y JPEG son compatibles; HEIC/HEIF depende del soporte del dispositivo y se convierte en los móviles compatibles. No se promete decodificación universal de SVG, RAW, archivos dañados o formatos no soportados por el sistema. Una imagen no compatible muestra un error y permite elegir otra. No se solicita acceso a cámara ni micrófono.

La tarjeta de Mis clubes muestra el escudo a la derecha del nombre. Dentro del club aparece pequeño arriba a la izquierda, junto al ID de la sesión a la derecha. Una imagen ausente o que no pueda cargarse no impide entrar al club.

## Configuración manual

Aplicar `supabase/migrations/20261016220000_club_crests.sql` después de las migraciones anteriores. Crea el bucket privado `club-crests` con límite de 5 MiB y MIME PNG, las políticas Storage y la columna `clubs.crest_path`. Los capitanes escriben únicamente `club-id/crest.png` de su club; los miembros leen mediante URLs firmadas de una hora. El directorio público no expone el escudo ni su URL firmada. La subida utiliza el cliente autenticado y no necesita nuevas claves ni secretos.

Solo los capitanes pueden vincular un escudo mediante `set_club_crest`. El cliente no tiene permiso de actualización directa de esa columna. Crear un club y subir un archivo son operaciones separadas: si falla el escudo, la pantalla conserva el ID del club creado y permite reintentar sin duplicarlo. Al reemplazar se reutiliza la misma ruta. Quitar el escudo desvincula la ruta y solicita eliminar el archivo mediante Storage. No hay cambios remotos automáticos.

La galería y conversión nativas requieren una nueva APK con expo-image-picker y expo-image-manipulator compatibles con SDK 57; la web se actualiza al desplegarla. Probar PNG transparente, JPEG y HEIC en móviles compatibles, cancelar el selector, imágenes incompatibles, fallo de subida y reintento, cambio/retirada del escudo y permisos de jugador/otro club.

Las pruebas SQL usan una superficie mínima de Storage para comprobar RLS; no sustituyen la prueba de carga en el proyecto Supabase real. La prueba de navegador usa API simulada y comprueba selección de PNG, conversión, transparencia y posiciones visuales. No se suben imágenes al entorno remoto durante las pruebas.
