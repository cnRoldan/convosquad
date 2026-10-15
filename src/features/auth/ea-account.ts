import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

export const eaIdPattern = /^[A-Za-z0-9_-]{3,24}$/;

export class EaAccountError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'EaAccountError';
    this.code = code;
  }
}

export function eaAccountEmail(eaId: string): string {
  const normalized = eaId.trim().toLowerCase();
  if (!eaIdPattern.test(normalized)) throw new EaAccountError('invalid_ea_id');
  return `ea.${normalized}@accounts.convosquad.invalid`;
}

type Client = Pick<SupabaseClient<Database>, 'auth' | 'rpc'>;

export async function registerEaAccount(client: Client, input: { eaId: string; password: string }, settings: unknown) {
  const email = eaAccountEmail(input.eaId);
  if (input.password.length < 8) throw new EaAccountError('weak_password');
  if (!settings || typeof settings !== 'object' || !('mailer_autoconfirm' in settings) || settings.mailer_autoconfirm !== true || ('disable_signup' in settings && settings.disable_signup === true)) {
    throw new EaAccountError('ea_registration_unavailable');
  }
  const availability = await client.rpc('is_ea_id_available', { p_ea_id: input.eaId.trim() });
  if (availability.error) throw new EaAccountError('ea_registration_unavailable');
  if (availability.data !== true) throw new EaAccountError('ea_id_taken');
  const { data, error } = await client.auth.signUp({
    email,
    password: input.password,
    options: { data: { username: input.eaId.trim(), login_type: 'ea_id' } },
  });
  if (error) {
    if (error.code === 'user_already_exists' || error.code === 'email_exists') throw new EaAccountError('ea_id_taken');
    const recheck = await client.rpc('is_ea_id_available', { p_ea_id: input.eaId.trim() });
    if (!recheck.error && recheck.data === false) throw new EaAccountError('ea_id_taken');
    throw error;
  }
  if (!data.session) throw new EaAccountError('ea_registration_unavailable');
  return data;
}

export async function loginEaAccount(client: Pick<Client, 'auth'>, eaId: string, password: string) {
  const { data, error } = await client.auth.signInWithPassword({ email: eaAccountEmail(eaId), password });
  if (error) throw error;
  return data;
}
