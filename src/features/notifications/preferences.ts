import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';

export async function getNotificationPreferences() {
  const { data, error } = await requireSupabase().from('notification_preferences').select('vote_notifications').maybeSingle();
  if (error) throw error;
  return data ?? { vote_notifications: true };
}
export async function setVoteNotifications(enabled: boolean) {
  return unwrap(await requireSupabase().rpc('set_notification_preferences', { p_vote_notifications: enabled }).single());
}
