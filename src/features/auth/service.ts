import { requireSupabase } from '@/lib/supabase';

export const usernamePattern = /^[A-Za-z0-9_]{3,24}$/;

export async function registerAccount(input: { username: string; email: string; password: string; redirectTo: string }) {
  if (!usernamePattern.test(input.username.trim())) throw new Error('Nombre de usuario inválido.');
  const { data, error } = await requireSupabase().auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { username: input.username.trim() }, emailRedirectTo: input.redirectTo },
  });
  if (error) throw error;
  return data;
}

export async function loginAccount(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function logoutAccount() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}

export async function requestRecovery(email: string, redirectTo: string) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}

export async function verifyRecoveryCode(email: string, token: string) {
  const { error } = await requireSupabase().auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'recovery' });
  if (error) throw error;
}

export async function changeRecoveredPassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}

export function authErrorMessage(error: unknown, operation: 'login' | 'register' | 'recovery' | 'password'): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'email_not_confirmed') return 'Confirma tu correo antes de iniciar sesión.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') return 'Has realizado varios intentos. Espera unos minutos y vuelve a intentarlo.';
  if (code === 'otp_expired') return 'El código ha caducado o no es válido. Solicita uno nuevo.';
  if (code === 'same_password') return 'Elige una contraseña diferente de la anterior.';
  if (code === 'weak_password') return 'Elige una contraseña más segura.';
  if (operation === 'login') return 'No se pudo iniciar sesión. Comprueba el correo, la contraseña y tu conexión.';
  if (operation === 'register') return 'No se pudo crear la cuenta. Revisa los datos y el nombre de usuario, que debe ser único.';
  if (operation === 'password') return 'No se pudo cambiar la contraseña. Solicita un nuevo acceso de recuperación.';
  return 'No se pudo completar la recuperación. Revisa el código y vuelve a intentarlo.';
}
