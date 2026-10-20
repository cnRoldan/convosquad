# Correcciones de las pruebas móviles — 20 de octubre de 2026

- Las pantallas de administración y de cuenta tienen regreso visible incluso al ser la primera ruta de su grupo. Rendimiento sale de las pestañas y vuelve expresamente al club.
- Las pantallas con cabecera nativa no duplican el área segura superior ni el ajuste automático del contenido. La franja de identidad conserva los mismos controles en todas las vistas.
- Buscar clubes oculta el teclado tanto al pulsar Buscar como desde la acción del teclado.
- Convocatorias usan calendario y reloj nativos en iOS/Android y campos date/time en web. Los valores siguen siendo componentes locales de la zona del club; no se convierten usando la zona del dispositivo.
- Los diálogos compartidos admiten desplazamiento, áreas seguras y ajuste ante teclado, incluido el formulario ampliado de valoración.
- Iconos de navegación vectoriales: house, shirt y user-round-check. Licencia en lucide-license.txt.
- `add_or_restore_player` recupera la ficha inactiva por EA ID sin duplicarla y sin perder identidad/cuenta. Un duplicado activo produce un aviso específico de jugador.
- Un trigger incorpora altas/reactivaciones a convocatorias abiertas actuales y vincula su cuenta al asociarla después. Conserva votos existentes, decisiones mantenidas y límites de votación; no modifica convocatorias cerradas ni históricas. La migración completa candidatos que faltaban, sin sobrescribir filas existentes.

## Despliegue y verificación

Migración: `20261020000100_roster_open_call_up_sync.sql`, aplicada a Supabase. RPC solo para capitanes activos; anónimos sin ejecución.

Verificado: TypeScript/ESLint, 115 pruebas unitarias, 158 de base de datos, 58 de interfaz, exportación web y bundles Hermes iOS/Android.

Se necesita una nueva build por plataforma para instalar el componente nativo de fecha/hora. No se ha ejecutado EAS Build. Pendiente de prueba física en TestFlight/Android: selectores, gesto de regreso, teclado y alturas con área segura.
