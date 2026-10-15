export function authErrorMessage(error: unknown, operation: 'login' | 'register' | 'recovery' | 'password' | 'callback'): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'current_password_required') return 'Introduce tu contraseña actual.';
  if (code === 'current_password_incorrect' || code === 'wrong_password') return 'La contraseña actual no es correcta.';
  if (code === 'password_too_short') return 'La nueva contraseña debe tener al menos 8 caracteres.';
  if (code === 'password_mismatch') return 'Las contraseñas nuevas no coinciden.';
  if (code === 'reauthentication_needed' || code === 'reauthentication_not_valid') return 'Vuelve a iniciar sesión antes de cambiar la contraseña.';
  if (code === 'invalid_ea_id') return 'El ID de EA debe tener entre 3 y 24 letras, números, guiones o guiones bajos.';
  if (code === 'ea_id_taken' || code === 'user_already_exists') return 'Este ID de EA ya está registrado. Usa otro o contacta con el administrador.';
  if (code === 'ea_registration_unavailable') return 'El registro por ID de EA todavía no está habilitado. Contacta con el administrador.';
  if (code === 'invalid_credentials') return 'El ID de EA o la contraseña no son correctos. Comprueba tus datos.';
  if (code === 'email_not_confirmed') return 'No se ha habilitado el acceso a esta cuenta. Contacta con el administrador.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || code === 'over_sms_send_rate_limit') return 'Has realizado varios intentos. Espera unos minutos y vuelve a intentarlo.';
  if (code === 'otp_expired' || code === 'flow_state_expired' || code === 'flow_state_not_found') return 'El enlace o código ha caducado, ya se ha utilizado o no es válido. Solicita uno nuevo.';
  if (code === 'pkce_code_verifier_not_found' || code === 'bad_code_verifier') return 'El enlace no se puede verificar desde este navegador y dispositivo. Contacta con el administrador.';
  if (code === 'same_password') return 'Elige una contraseña diferente de la anterior.';
  if (code === 'weak_password') return 'Elige una contraseña más segura.';
  if (code === 'session_not_found' || code === 'session_expired') return 'Tu sesión ha caducado. Vuelve a iniciar sesión.';
  if (error instanceof TypeError || (error instanceof Error && error.name === 'AuthRetryableFetchError')) return 'No se pudo conectar con el servicio de acceso. Comprueba tu conexión y vuelve a intentarlo.';
  if (operation === 'login') return 'No se pudo iniciar sesión. Comprueba tus datos y tu conexión.';
  if (operation === 'register') return 'No se pudo crear la cuenta. Revisa el ID de EA, que debe ser único, y tu conexión.';
  if (operation === 'password') return 'No se pudo cambiar la contraseña. Comprueba tu conexión y vuelve a intentarlo.';
  if (operation === 'callback') return 'El enlace no se pudo verificar. Contacta con el administrador.';
  return 'No se pudo completar la recuperación. Revisa el código y vuelve a intentarlo.';
}
