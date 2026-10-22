import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export async function deactivateOwnedDevice(client: SupabaseClient<Database>, userId: string, deviceId: string, unlink: boolean) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    // An installation ID can outlive the account/session that registered it.
    // RLS only exposes the current user's rows; nothing to unlink for this user
    // when that ID belongs to a previous account (or was already deleted).
    const owned = await client.from('push_devices').select('device_id').eq('device_id', deviceId).eq('user_id', userId).abortSignal(controller.signal).maybeSingle();
    if (owned.error) throw owned.error;
    if (!owned.data) return;
    const { error } = await client.rpc('deactivate_push_device', { p_device_id: deviceId, p_unlink: unlink }).abortSignal(controller.signal);
    if (error) throw error;
  } finally { clearTimeout(timeout); }
}
