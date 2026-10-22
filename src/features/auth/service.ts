import { deleteOwnAccount } from './account-deletion';
import type { Database } from '@/types/database';
import { createClient } from '@supabase/supabase-js';
import { changeOwnPassword, type PasswordChangeInput } from './password-change';
import { requireSupabase } from '@/lib/supabase';
import { EaAccountError, loginEaAccount, registerEaAccount } from './ea-account';
import { endDeviceSession } from './logout';
import { deactivateInstallation } from '@/features/notifications/device-service';

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

export async function logoutAccount() {
  await endDeviceSession(requireSupabase(), userId => deactivateInstallation(userId, true));
}

export async function changeAccountPassword(userId: string, input: PasswordChangeInput) {
  const client = requireSupabase();
  const verifier = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'convosquad-password-check' } },
  );
  return changeOwnPassword(client, verifier, userId, input);
}

export async function deleteAccount(userId: string, password: string, confirmation: string) {
  const verifier = createClient<Database>(
    process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'convosquad-deletion-check' } },
  );
  return deleteOwnAccount(requireSupabase(), verifier, userId, password, confirmation);
}
