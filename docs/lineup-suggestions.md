# Sugerencias al cambiar un jugador

El selector de un hueco vacío u ocupado incluye Banquillo, Campo y Sugerencias. Las sugerencias solo incluyen jugadores activos que ya están en el campo o el banquillo, excluyendo al ocupante del hueco. Elegir una sugerencia usa la misma asignación o intercambio del selector habitual y conserva las marcas de incidencias.

Se comparan los grupos que guarda la plantilla: porteros, centrales, laterales/carrileros, centrocampistas y atacantes. La posición se deduce de la ubicación del hueco y la formación; no se usa el número del slot como posición fija. No existen posiciones de plantilla más específicas, como DC frente a EI, en la ficha actual.

Los motivos son «Posición de plantilla» y «Ya jugó aquí», con el número de convocatorias. Primero aparecen las coincidencias de plantilla, después la experiencia histórica; en igualdad de condiciones se prioriza el banquillo y luego el nombre. Si el histórico falla, siguen disponibles las coincidencias de plantilla y un botón para reintentar.

La RPC `lineup_position_experience` exige capitán del club y acceso a la alineación de la convocatoria consultada. Devuelve únicamente identificador estable del jugador, grupo de posición y cantidad de convocatorias distintas. Cuenta alineaciones publicadas de convocatorias previas, finalizadas y no canceladas del mismo club; excluye borradores, la convocatoria actual, invitados e inactivos. No devuelve documentos históricos ni elude el acceso Prémium a la consulta de alineaciones completas. La referencia es el once publicado, no una comprobación externa de participación efectiva.

Migración: `20261104000100_lineup_position_experience.sql`, aplicada en Supabase. Se verificó que la RPC no admite ejecución anónima. Las pruebas cubren roles entre formaciones, selección e intercambio, permisos, agregación y ausencia de histórico.

Validación específica: 193 pruebas unitarias, las pruebas de experiencia e histórico en base de datos y las dos pruebas visuales del selector pasan; TypeScript, lint y tipos de base de datos también pasan. La batería visual general de convocatorias muestra fallos fuera del selector, que deben revisarse antes de dar por cerrada la validación global del lanzamiento.
