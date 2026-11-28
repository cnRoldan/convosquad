import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import { eaAccountEmail } from './ea-account.ts';

type Client = Pick<SupabaseClient<Database>, 'auth' | 'rpc'>;
export type EaIdChangeInput = { currentEaId: string; newEaId: string; currentPassword: string };
export class EaIdChangeError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
export async function changeOwnEaId(client: Client, verifier: Client, userId: string, input: EaIdChangeInput) {
  const newEaId = input.newEaId.trim();
  const newEmail = eaAccountEmail(newEaId);
  if (!input.currentPassword) throw new EaIdChangeError('current_password_required');
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (data.user?.id !== userId || !data.user.email) throw new EaIdChangeError('session_expired');
  if (data.user.email !== eaAccountEmail(input.currentEaId)) throw new EaIdChangeError('P4105');
  const verified = await verifier.auth.signInWithPassword({ email: data.user.email, password: input.currentPassword });
  if (verified.error) throw verified.error.code === 'invalid_credentials' ? new EaIdChangeError('current_password_incorrect') : verified.error;
  let changed = false;
  try {
    if (verified.data.user?.id !== userId || (await client.auth.getSession()).data.session?.user.id !== userId) throw new EaIdChangeError('session_expired');
    // Use the fresh, isolated password session so the server can enforce AMR freshness.
    const result = await verifier.rpc('change_my_ea_id', { p_current_ea_id: input.currentEaId, p_new_ea_id: newEaId });
    if (result.error) {
      if (result.error.code && !['FetchError', 'NETWORK_ERROR'].includes(result.error.code)) throw result.error;
      // A connection can fail after commit: check the account before reporting a failure.
      const check = await verifier.auth.getUser();
      if (check.error || check.data.user?.id !== userId || check.data.user.email !== newEmail || check.data.user.user_metadata.username !== newEaId) throw new EaIdChangeError('ea_id_change_uncertain');
    } else if (result.data !== newEaId) throw new EaIdChangeError('ea_id_change_uncertain');
    changed = true;
  } finally {
    // Do not turn a successful atomic rename into an apparent failure if cleanup is offline.
    await verifier.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
  if (!changed) throw new EaIdChangeError('ea_id_change_uncertain');
  if ((await client.auth.getSession()).data.session?.user.id !== userId) return { eaId: newEaId, sessionRefreshed: false };
  try {
    const refreshed = await client.auth.refreshSession();
    return { eaId: newEaId, sessionRefreshed: !refreshed.error && refreshed.data.user?.id === userId && refreshed.data.user.email === newEmail };
  } catch { return { eaId: newEaId, sessionRefreshed: false }; }
}
