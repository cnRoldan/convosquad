# Corrección del acceso biométrico

En iOS, Face ID puede devolver un resultado correcto antes del evento que devuelve la aplicación de `inactive` a `active`. El bloqueo anterior rechazaba ese resultado al seguir oculta la app; al volver a primer plano solicitaba Face ID otra vez. La corrección acepta ese orden de eventos y mantiene la cubierta de privacidad hasta volver a `active`. Entrar realmente en `background` invalida cualquier reconocimiento pendiente.

Cada ciclo de bloqueo admite un único intento automático. Tras cancelar o fallar se conserva la sesión y el usuario debe pulsar «Desbloquear» para reintentar. No se inicia otro reconocimiento mientras haya uno pendiente, incluso al cambiar de cuenta. Un reconocimiento correcto seguido de más de 30 segundos de inactividad vuelve a exigir autenticación.

El intento automático espera a que se haya presentado la pantalla de bloqueo. Activar o desactivar la biometría desde ajustes no presenta otro modal nativo durante el cierre de Face ID. La navegación permanece montada detrás de la cubierta, sin acceso táctil ni accesible mientras está bloqueada. El selector de idioma de esa cubierta es desplegable en la propia pantalla y admite desplazamiento en dispositivos pequeños.

El login y el registro ofrecen selección de idioma sin sesión. La restauración aplica primero la preferencia local del usuario o del dispositivo y después consulta el perfil. El idioma restaurado del perfil se guarda también para la próxima pantalla de login. Una respuesta tardía del servidor no sobrescribe una selección manual posterior. Los textos del bloqueo y de sus ajustes están traducidos a los cuatro idiomas.

Pruebas: secuencias de Face ID resuelto antes y después de `active`, cancelación, excepción, activación, segundo plano real, cuenta cambiada y límite de 30 segundos; restauración del idioma sin red, servidor lento, cierre de sesión y cambio manual concurrente; Chromium para cambiar idioma sin sesión y conservarlo al recargar. Estas pruebas simulan los eventos; la validación del diálogo nativo de Face ID requiere un iPhone físico.
