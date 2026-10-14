# Convocatorias compactas

Esta PR parte de `main` después de la PR 10. En la inspección no había PR abiertas ni otro trabajo visible dedicado a compactar convocatorias. Se reutilizan snapshots, servicios, RPC de respuesta, permisos y el ciclo Realtime existente; no se modifican migraciones, RLS ni datos remotos.

## Interfaz y archivos

- `src/app/(club)/call-up.tsx`: integra la lista, compacta la barra de acciones, conserva selección de convocatorias e historial y aplica una respuesta optimista únicamente a la ficha propia. Un bloqueo síncrono evita RPC duplicadas incluso antes del siguiente render; los mensajes y la respuesta temporal están aislados por cuenta, club y convocatoria. Un rechazo revierte el cambio local y vuelve a consultar datos reales.
- `src/features/call-ups/compact-roster.tsx`: filas con EA ID completo, `#`, disponibilidad y aviso de ficha sin registrar. Cuatro contadores interactivos y cinco filtros, disponibles para miembros y administradores. Los cálculos se derivan de los snapshots, sin consultas por cambiar un filtro. Solo el titular de una ficha registrada ve controles, en una convocatoria abierta y vigente.
- `src/features/call-ups/compact-panel.tsx`: panel reutilizable con botón de al menos 44 px y estado expandido accesible. Las seis categorías oficiales arrancan abiertas y conservan su estado al filtrar o actualizar. Los contadores de categoría siguen representando toda esa categoría, incluso al filtrar. Las categorías vacías permanecen en Todos.
- `src/features/call-ups/list-model.ts`: agrupación, orden, filtros y contadores oficiales; excluye tipos ajenos a las categorías oficiales y centraliza la comprobación visual de titularidad. El servidor sigue siendo quien autoriza las respuestas.
- `src/features/call-ups/aids-section.tsx` y `administration.tsx`: reutilizan CRUD, orden y diálogos existentes dentro de paneles compactos. AYUDAS y PRUEBAS no cuentan y se ocultan con filtros activos, sin desmontar AYUDAS ni generar consultas nuevas. La administración empieza contraída; las categorías oficiales, PRUEBAS y AYUDAS empiezan expandidas. Las pruebas mostradas siguen siendo la fotografía histórica, no una consulta de la plantilla actual.
- `src/features/players/jersey.ts`, `player-card.tsx`, `src/features/trials/trial-section.tsx` y `src/app/(manage)/inactive-players.tsx`: valores de dorsal con `#` y etiquetas accesibles completas. Los formularios conservan Dorsal como nombre de campo. El histórico abre la misma vista compacta de snapshots.
- `src/components/ui.tsx`: modo compacto opcional de Screen, aplicado solo a convocatorias. Los otros tamaños de pantalla se conservan.
- `tests/compact-call-up.test.mjs`, `tests/ui/compact-call-up.test.mjs` y `scripts/test-call-up-ui.mjs`: pruebas de cálculos y de la interfaz real con Supabase REST y WebSocket interceptados. `package.json`/lock añaden Playwright únicamente para desarrollo; CI ejecuta estas pruebas. `.gitignore` y ESLint excluyen la exportación de fixtures y capturas generadas.

Las filas de consulta comunes miden aproximadamente 36 px en las pruebas; nombres largos, texto ampliado y filas con controles pueden ocupar más espacio. Las acciones mantienen al menos 44 px de alto. A 320 px el resumen pasa a dos columnas; a 390 px y escritorio usa cuatro. Los chips permiten desplazamiento horizontal. Estados, selección y expansión se comunican con iconos, texto, borde y atributos de accesibilidad; no dependen solo del color. No se añade animación de altura para mantener una expansión inmediata y evitar trabajo extra al actualizar respuestas.

## Pruebas reproducibles

```sh
npm ci
npm run check
npm run test
npm run export
npx playwright install chromium
npm run test:ui
```

Si se dispone de Chromium instalado, `CHROMIUM_EXECUTABLE_PATH` puede señalar su ejecutable. En Linux, el runner usa `/usr/bin/chromium` si existe. `npm run test:ui` exporta a `dist-ui` con URL/clave ficticias y ejecuta Chromium: intercepta todos los accesos REST y WebSocket; no utiliza cuentas o datos reales. Las capturas quedan en `test-results/call-up-320.png`, `call-up-390.png` y `call-up-1280.png`; CI las adjunta como artifact `compact-call-up-screenshots`.

Las pruebas verifican filas compactas, nombres largos, dorsales y accesibilidad, botones de 44 px, categorías colapsables y conservación al filtrar, cuatro contadores globales, contadores de categorías, los cinco filtros, exclusión de PRUEBAS/AYUDAS, fichas ajenas y sin registrar sin controles, ausencia de peticiones por filtrar, cambios recibidos por WebSocket, actualización optimista, pulsaciones duplicadas, rechazo del servidor con restauración y estados vacíos. El modelo también se verifica con 40 jugadores. Las pruebas de base de datos se ejecutan en PGlite local; no conectan a producción.

La exportación de Expo verifica bundles de web, Android e iOS (incluido bytecode Hermes). Este entorno Linux no dispone de Xcode, SDK Android ni Gradle para compilar/ejecutar binarios nativos. Quedan pendientes pruebas en dispositivos físicos, VoiceOver/TalkBack, texto del sistema ampliado y reconexión con el proyecto Supabase real. La suite conserva las pruebas existentes del ciclo Realtime de reconexión, sondeo, limpieza y descarte de canales antiguos.

## Validar desde Netlify

1. Abrir el Deploy Preview que Netlify publique en la PR, sin fusionar. La configuración pública de build existente se conserva; no hay nuevas variables de aplicación. El directorio publicado sigue siendo `dist`, nunca `dist-ui`.
2. Para una revisión visual sin escrituras: elegir Explorar la demo, entrar en un club y abrir Convocatoria. Probar contadores, filtros, colapsado y una ventana de 320–390 px. La demo no envía respuestas. El segundo club tiene un estado Backup para revisar ese filtro.
3. Para verificar integración real: iniciar sesión con una cuenta propia de un club de pruebas que ya tenga una convocatoria abierta. Comparar las cuatro cifras con la plantilla oficial, incluyendo fichas sin registrar y excluyendo pruebas/ayudas. Abrir y cerrar paneles, cambiar filtros y volver a Todos.
4. Responder solo sobre la ficha propia. Confirmar que la selección y cifras cambian mientras se guarda. Desde una segunda cuenta miembro, observar la actualización en directo y que no aparecen controles sobre respuestas ajenas. Repetir con administrador: tampoco debe editar respuestas de otros. En Pendientes, una respuesta Disponible debe desaparecer del filtro y aumentar el contador correspondiente.
5. Interrumpir la conexión y volver a conectarse; comprobar aviso, recuperación y actualización manual. Abrir un histórico como administrador: filas compactas, snapshots conservados y ausencia de controles de respuesta. Cerrar una convocatoria de pruebas únicamente si se pretende hacerlo; no hace falta para comprobar el diseño.

Los datos, correos y tokens reales no se deben incorporar a capturas o a fixtures. Las verificaciones simuladas no demuestran por sí solas que Realtime funcione en el proyecto alojado ni que una build nativa instalada funcione en cada dispositivo.

## Resultado local

Pasan TypeScript y lint, 61 pruebas unitarias (11 nuevas de modelo/formato/permisos), 58 pruebas locales de base de datos, sincronización de tipos y seis escenarios automatizados de Chromium. Se revisaron capturas de móvil y escritorio. No se hizo ninguna operación sobre Supabase remoto. La exportación web se comprueba también durante `test:ui`; `npm run export` genera además los bundles de iOS y Android. La integración con cuentas reales y dispositivos instalados requiere el recorrido manual anterior.
