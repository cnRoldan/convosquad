# Aviso de admisión a un club

Al pasar una solicitud de pendiente a aprobada, un trigger crea un evento `club_approved` y entregas únicamente para los dispositivos activos de la cuenta admitida. No exige ficha de jugador ni convocatoria. El nombre del club se conserva en el evento; el texto está traducido a los cuatro idiomas. No incluye botones para votar.

La aprobación, la pertenencia y el evento se guardan en la misma transacción. Un error de vinculación no deja un aviso de éxito. La clave por solicitud evita duplicados. Rechazar solicitudes no envía avisos y no se generan notificaciones retroactivas para aprobaciones anteriores a la migración.

Antes de reservar una entrega se comprueba otra vez la aprobación, la cuenta destinataria, la pertenencia activa y el dispositivo/token. Las preferencias de avisos de votos no silencian las admisiones. Las reglas de notificación de convocatorias siguen en `private.claim_call_up_push_deliveries`, detrás del dispatcher público reservado al worker.

El servicio `send-reminders` procesa la cola con el cron existente `convosquad-reminders` (cada minuto). Una respuesta aceptada por Expo no garantiza que el sistema operativo muestre el aviso: sigue requiriendo permiso de notificaciones y un token válido.

Al tocar el aviso, la app comprueba que la sesión corresponde al destinatario, actualiza los clubes desde el servidor y abre el club solo si sigue existiendo acceso. Si falta sesión conserva el aviso al iniciar sesión. No utiliza un UUID de convocatoria ficticio ni intenta votar.

## Despliegue

Migración: `20261020000200_club_admission_push.sql`. Worker actualizado y migración aplicados en Supabase; permisos verificados. No se han creado cuentas de prueba ni enviado pushes reales manualmente.

Para desplegar el worker desde el repositorio se necesita el import map:

```bash
npx supabase functions deploy send-reminders --project-ref cirdgzlecufhcgkszbvt --use-api --import-map supabase/functions/deno.json
```

Se necesita una nueva build para incorporar el acceso al club al tocar el aviso. Las builds anteriores pueden recibir el texto push, pero no reconocen su nuevo destino. No se ha iniciado EAS Build.
