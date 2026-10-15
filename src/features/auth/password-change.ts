import type { SupabaseClient } from '@supabase/supabase-js';

type AuthClient = Pick<SupabaseClient, 'auth'>;
export type PasswordChangeInput = { currentPassword: string; newPassword: string; confirmation: string };

export class PasswordChangeError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export function validatePasswordChange(input: PasswordChangeInput) {
  if (!input.currentPassword) throw new PasswordChangeError('current_password_required');
  if (input.newPassword.length < 8) throw new PasswordChangeError('password_too_short');
  if (input.newPassword !== input.confirmation) throw new PasswordChangeError('password_mismatch');
  if (input.newPassword === input.currentPassword) throw new PasswordChangeError('same_password');
}

export async function changeOwnPassword(client: AuthClient, verifier: AuthClient, userId: string, input: PasswordChangeInput) {
  validatePasswordChange(input);
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user?.email || data.user.id !== userId) throw new PasswordChangeError('session_expired');

  // La comprobación usa una sesión efímera, sin reemplazar la sesión de la aplicación.
  const verified = await verifier.auth.signInWithPassword({ email: data.user.email, password: input.currentPassword });
  if (verified.error) {
    if (verified.error.code === 'invalid_credentials') throw new PasswordChangeError('current_password_incorrect');
    throw verified.error;
  }
  try {
    if (verified.data.user?.id !== userId) throw new PasswordChangeError('session_expired');
  } finally {
    const { error: cleanupError } = await verifier.auth.signOut({ scope: 'local' });
    if (cleanupError) throw cleanupError;
  }
  const { data: current } = await client.auth.getSession();
  if (current.session?.user.id !== userId) throw new PasswordChangeError('session_expired');
  const result = await client.auth.updateUser({ password: input.newPassword, current_password: input.currentPassword });
  if (result.error) throw result.error;
}
