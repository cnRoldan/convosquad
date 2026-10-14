import { requireSupabase } from '@/lib/supabase';

export { authErrorMessage } from './errors';

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
  const { data, error } = await requireSupabase().auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'recovery' });
  if (error) throw error;
  if (!data.session) throw new Error('Missing recovery session');
}

export async function changeRecoveredPassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}
