import type { SupabaseClient } from '@supabase/supabase-js';

export class LogoutError extends Error {
  readonly code: 'device_unlink_failed' | 'session_logout_failed';
  constructor(code: 'device_unlink_failed' | 'session_logout_failed') { super(code); this.code = code; }
}

export function logoutErrorMessage(error: unknown) {
  return error instanceof LogoutError && error.code === 'device_unlink_failed'
    ? 'No se pudo desvincular este dispositivo de las notificaciones. Vuelve a intentar cerrar sesión.'
    : 'No se pudo cerrar la sesión. Inténtalo de nuevo.';
}

export async function endDeviceSession(client: Pick<SupabaseClient, 'auth'>, unlink: (userId: string) => Promise<void>) {
  const { data } = await client.auth.getSession();
  if (data.session) {
    try { await unlink(data.session.user.id); }
    catch {
      // Expired/revoked sessions cannot unlink a device. They must still be
      // removable locally; a live session must unlink before it is revoked.
      const current = await client.auth.getSession();
      if (current.error || current.data.session) throw new LogoutError('device_unlink_failed');
    }
  }
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) {
    // The SDK also removes local credentials when remote revocation fails.
    // Report failure only if a session remains or its removal is unverified.
    const current = await client.auth.getSession();
    if (current.error || current.data.session) throw new LogoutError('session_logout_failed');
  }
}
