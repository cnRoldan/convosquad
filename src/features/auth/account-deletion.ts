import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';
import { backendErrorMessage } from '../../lib/backend-result.ts';

type Client = Pick<SupabaseClient<Database>, 'auth' | 'rpc'>;
export class AccountDeletionError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export async function deleteOwnAccount(client: Client, verifier: Client, userId: string, password: string, confirmation: string) {
  if (!password) throw new AccountDeletionError('current_password_required');
  if (!confirmation.trim()) throw new AccountDeletionError('P4001');
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user?.email || data.user.id !== userId) throw new AccountDeletionError('session_expired');
  const verified = await verifier.auth.signInWithPassword({ email: data.user.email, password });
  if (verified.error) throw verified.error;
  try {
    if (verified.data.user?.id !== userId) throw new AccountDeletionError('session_expired');
    const { data: current } = await client.auth.getSession();
    if (current.session?.user.id !== userId) throw new AccountDeletionError('session_expired');
    // Use the freshly authenticated session; the server checks its password AMR.
    const result = await verifier.rpc('delete_my_account', { p_confirmation: confirmation.trim() });
    if (result.error) throw result.error;
  } finally {
    // A cleanup failure must not turn a completed deletion into a retry prompt.
    await verifier.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
}

export function accountDeletionError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'P4001') return 'Escribe tu ID de EA para confirmar la eliminación.';
  if (code === 'P4002') return 'Eres el único capitán de un club. Nombra a otro capitán o elimina ese club antes de borrar tu cuenta.';
  if (code === 'P4003') return 'Vuelve a introducir tu contraseña para confirmar la eliminación.';
  if (code === 'invalid_credentials' || code === 'current_password_required') return 'Introduce tu contraseña actual correctamente.';
  if (code === 'session_expired' || code === 'user_not_found') return 'Tu sesión ha caducado. Vuelve a iniciar sesión.';
  return backendErrorMessage(error);
}
