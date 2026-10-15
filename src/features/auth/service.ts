import { requireSupabase } from '@/lib/supabase';
import { EaAccountError, loginEaAccount, registerEaAccount } from './ea-account';

export { authErrorMessage } from './errors';

export async function registerAccount(input: { eaId: string; password: string }) {
  const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')}/auth/v1/settings`, {
    headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '' },
  });
  if (!response.ok) throw new EaAccountError('ea_registration_unavailable');
  return registerEaAccount(requireSupabase(), input, await response.json());
}

export async function loginAccount(eaId: string, password: string) {
  return loginEaAccount(requireSupabase(), eaId, password);
}

export async function loginLegacyAccount(email: string, password: string) {
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
