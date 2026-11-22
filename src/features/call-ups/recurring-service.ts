import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import type { Database } from '@/types/database';
export type RecurringCallUp = Database['public']['Tables']['recurring_call_ups']['Row'];
export async function getRecurringCallUp(clubId: string) {
  return unwrap(await requireSupabase().from('recurring_call_ups').select('*').eq('club_id', clubId).maybeSingle());
}
export async function createRecurringCallUp(input: {
  clubId: string; firstDate: string; weekdays: number[]; startTime: string; endTime: string; noticeTime: string | null; closingTime: string | null; ratingsEnabled: boolean;
}) {
  return unwrap(await requireSupabase().rpc('create_recurring_call_up', {
    p_club_id: input.clubId, p_first_date: input.firstDate, p_weekdays: input.weekdays, p_start_time: input.startTime, p_end_time: input.endTime,
    ...(input.noticeTime ? { p_notice_time: input.noticeTime } : {}), ...(input.closingTime ? { p_closing_time: input.closingTime } : {}), p_ratings_enabled: input.ratingsEnabled,
  }).single());
}
export async function stopRecurringCallUp(clubId: string) {
  const { error } = await requireSupabase().rpc('stop_recurring_call_up', { p_club_id: clubId });
  if (error) throw error;
}
