# Política de privacidad y declaración de datos

La política pública de ConvoSquad se sirve en `/privacy`, sin inicio de sesión. El
texto está en `src/features/legal/privacy.ts` en español, inglés, alemán y francés.
Los textos de la página y el idioma se cambian también sin una cuenta. Los enlaces
están disponibles en bienvenida, registro/login, selección de clubes y eliminación
de cuenta. El AAB anterior no incorpora esos enlaces: el cliente móvil debe
recompilarse antes de enviar esa nueva versión a revisión.

Responsable confirmado por el propietario: **Claudio Roldán Ramos, particular en
España**. Contacto público confirmado en la ficha de Play: **convosquad.soporte@gmail.com**.
Fecha de la política: **2026-10-19**. URL para Google Play:
`https://convosquad.netlify.app/privacy`.

## Evidencia utilizada

- Registro con ID de jugador y contraseña. Supabase crea una dirección técnica
  determinista; el registro actual no recoge un correo real ni credenciales de EA.
- Perfil, idioma, membresías y roles; nombres/descripciones/escudos de clubes;
  plantilla, convocatorias, votos, candados y valoraciones se guardan en Supabase.
- Teléfonos y observaciones opcionales de ayudas/pruebas: tablas separadas con RLS
  de capitanes. Personas sin cuenta pueden aparecer en esos registros.
- Ratings privados por defecto y visibilidad configurable. Confirmado en el
  proyecto remoto el cron diario activo `convosquad-purge-player-ratings` para
  borrar registros de más de tres meses.
- Confirmada por la API de Supabase la región **eu-west-1 (Irlanda)**. No se
  presupone que todos los proveedores o servicios auxiliares trabajen solo en la UE.
- Expo envía avisos mediante FCM/APNs; token, instalación aleatoria, plataforma,
  preferencias y eventos/entregas de avisos quedan registrados. El aviso puede
  incluir el ID de quien vota y su disponibilidad.
- Netlify sirve la web; Google/Gmail recibe los mensajes de soporte. Los enlaces
  voluntarios de WhatsApp abren el número elegido, no transmiten la agenda entera.
- No hay SDK publicitario ni integración de pagos en la versión actual. La política
  debe revisarse antes de integrar la compra de creación de club o la suscripción.
- Público objetivo acordado: **16+**; no existe captura de fecha de nacimiento ni
  control automático de edad. La política no afirma que se realice tal control.

## Conservación y atención de solicitudes

La política describe la retención de cuenta/club/historial, el corte de tres meses
para valoraciones y el flujo de eliminación ya implementado. No promete borrar
respaldos de proveedores ni inferir la identidad en registros de personas sin
cuenta o referencias en texto libre. Estas últimas solicitudes requieren revisión
por el responsable, al igual que rectificación y portabilidad cuando correspondan.

No se inventa un número de días para respaldos o logs de terceros. Se explican
sus ciclos y criterios de conservación y el contacto para solicitar información.
El responsable debe atender los mensajes de privacidad, verificar la identidad
con información mínima y borrar o anonimizar consultas y registros de seguridad
cuando ya no sean necesarios para su finalidad o para responsabilidades legales.

Para la sección Seguridad de los datos de Play, revisar las categorías según su
formulario concreto: datos de identidad/cuenta, teléfonos opcionales, imágenes,
contenido aportado por usuarios, actividad y decisiones de voto, e identificadores
de dispositivo/notificaciones. Los datos persisten; no son únicamente efímeros.
No confundir valoraciones de un videojuego con datos de salud/fitness, la zona
horaria elegida con GPS ni soporte por email fuera de la app con un campo de email
de registro. La definición de «compartir» en Play tiene excepciones específicas
para proveedores y acciones solicitadas por el usuario; debe revisarse en ese paso.

## Validación

Comprobar exportación estática pública, enlaces de entrada/salida y cambio de los
cuatro idiomas, además de TypeScript, ESLint y catálogos de traducciones. No se
requieren migraciones ni nuevas claves o permisos del dispositivo.
