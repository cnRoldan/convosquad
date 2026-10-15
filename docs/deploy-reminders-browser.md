# Desplegar send-reminders desde el navegador

## Antes de desplegar

Aplica las migraciones pendientes en orden, hasta `20261015220000_call_up_notifications.sql`. No repitas las iniciales. Si la tercera migración indica que `refresh_call_up_roster` ya existe, no la borres ni la ejecutes de nuevo: esa función ya está creada.

## Secretos de Edge Functions

1. Abre tu proyecto Supabase y entra en **Edge Functions → Secrets**.
2. Crea `PUSH_WORKER_SECRET` con una cadena criptográficamente aleatoria de al menos 32 caracteres, generada por tu gestor de contraseñas. Consérvala allí: también se usará en Vault. Si ya existe, reutilízala; no la cambies sin actualizar Vault.
3. Supabase proporciona `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` al servidor. No copies la clave de servidor a Expo, Netlify ni GitHub.
4. Solo si habilitaste la seguridad adicional de Expo Push, añade `EXPO_ACCESS_TOKEN` como secreto del servidor con un token que tenga acceso al proyecto Expo. No es la cuenta de servicio de Firebase.

## Código y despliegue

1. En **Edge Functions**, crea una función mediante **Deploy a new function → Via Editor** o abre el editor de `send-reminders` si existe. El nombre exacto es `send-reminders`.
2. Abre en GitHub `supabase/functions/send-reminders/dashboard.ts` y pulsa **Raw**. Copia todo su contenido.
3. Sustituye el contenido del `index.ts` del editor por ese archivo completo. Incluye las dependencias compartidas y usa el import npm fijado a la versión del repositorio. No pegues solo el `index.ts` original, que importa otros archivos.
4. Desactiva la verificación JWT de la plataforma para esta función, tanto al desplegar si aparece esa opción como en su configuración (**Verify JWT / Enforce JWT verification**, según la versión del panel). El worker valida su propio `PUSH_WORKER_SECRET` antes de procesar nada; un JWT de usuario no lo autoriza.
5. Pulsa **Deploy**. No añadas contraseñas ni claves dentro del código.
6. Comprueba que aparece como desplegada y que no hay errores de importación en sus logs. Abrir la URL sin autorización debe devolver 401; esta comprobación no envía notificaciones. Por sí sola no acredita configuración completa ni entrega al móvil.

El archivo para el editor se genera desde los tres archivos originales con `node scripts/export-reminder-dashboard.mjs`. No tiene una segunda implementación manual. `node scripts/export-reminder-dashboard.mjs --check` comprueba que sigue sincronizado; la validación Deno comprueba ambos puntos de entrada.

## Vault y ejecución periódica

Este paso activa envíos reales de la cola: complétalo cuando quieras comenzar las pruebas.

1. Habilita **Cron / pg_cron** y **pg_net** en el proyecto si faltan; utiliza las secciones Cron y Extensions del panel.
2. Abre **Vault** y guarda, usando su formulario de secretos:
   - `convosquad_supabase_url`: la Project URL de Supabase, sin barra al final.
   - `convosquad_reminder_worker_secret`: exactamente el mismo valor de `PUSH_WORKER_SECRET`.
3. Consulta la lista de jobs de Cron. Si ya existe `convosquad-reminders`, reutilízalo y comprueba que ejecuta el SQL siguiente cada minuto. No crees otro job para la misma cola.
4. Si no existe, ejecuta desde SQL Editor el bloque siguiente. No contiene credenciales: las consulta en Vault durante la ejecución.

```sql
select cron.schedule('convosquad-reminders', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'convosquad_supabase_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                    where name = 'convosquad_reminder_worker_secret')
    ),
    body := '{}'::jsonb
  );
$job$);
```

## Comprobaciones

Revisa las ejecuciones de Cron y los logs de la función. Un cron correcto solo confirma que programó la petición HTTP; confirma también el estado HTTP de la función. Un 401 exige revisar la verificación JWT y la coincidencia de los dos secretos; un 503 puede indicar migraciones pendientes o un problema del servicio de envío. Un 200 con `attempted: 0` significa que no se reservó ningún envío en esa ejecución.

Un ticket aceptado por Expo no demuestra recepción física. Para probar las tres acciones, instala una APK que incluya la PR #19 en dispositivos físicos con cuentas diferentes, activa notificaciones y vincula sus fichas. La APK anterior no incorpora este código por desplegar el worker.
