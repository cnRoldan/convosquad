# ConvoSquad 1.1.2 — cambios acumulados

Versión en preparación. No se ha compilado ni enviado a las tiendas; la 1.1.1
aprobada se mantiene independiente.

- Corrección del ID de acceso con contraseña actual, conservando la cuenta y
  su historial. Ya disponible en la web y el servidor. Detalles y validación en
  [account-id-correction.md](account-id-correction.md).
- Italiano y portugués de Portugal: app, preferencias, notificaciones,
  privacidad y página de descarga. Web y servidor actualizados; las apps
  instaladas incorporarán los idiomas con una nueva compilación.
- Eliminación del aviso «Expo Head: Add the handoff origin…» al abrir una
  invitación en iOS. La 1.1.1 montaba `expo-router/head` también en nativo, lo que
  activaba Handoff sin un origen configurado. Los metadatos de la invitación se
  limitan ahora a web, como los de privacidad. No se configura Handoff ni se
  altera la aceptación de invitaciones.

La regresión de invitaciones renderiza la pantalla para iOS y Android con sesión
en carga, enlace válido e inválido y comprueba que nunca monta Head ni canjea el
enlace automáticamente. En web conserva los metadatos genéricos, la vista previa
y `no-referrer` sin incluir el token. Pasan ocho pruebas de metadatos y enlaces,
TypeScript y lint. No constituye una prueba física de iPhone.
