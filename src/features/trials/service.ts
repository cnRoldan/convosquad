import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import type { RosterCategory } from '@/features/players/categories';
export async function listTrials(clubId: string, all = false) {
  let query = requireSupabase().from('club_trials').select('*').eq('club_id', clubId).order('sort_order').order('id');
  if (!all) query = query.eq('status', 'active');
  return unwrap(await query);
}
export async function saveTrial(clubId: string, input: { ea_id: string; jersey_number: number | null; position: string | null; notes: string | null }, id?: string) {
  return unwrap(await (id ? requireSupabase().from('club_trials').update(input).eq('id', id).eq('club_id', clubId)
    : requireSupabase().from('club_trials').insert({ club_id: clubId, ...input })).select().single());
}
export async function withdrawTrial(id: string) { return unwrap(await requireSupabase().rpc('withdraw_trial', { p_trial_id: id }).single()); }
export async function promoteTrial(id: string, category: RosterCategory, existingId?: string) {
  return unwrap(await requireSupabase().rpc('promote_trial', { p_trial_id: id, p_category: category, ...(existingId ? { p_existing_player_id: existingId } : {}) }).single());
}
export async function reorderTrials(clubId: string, ids: string[]) {
  const { error } = await requireSupabase().rpc('reorder_trials', { p_club_id: clubId, p_ids: ids }); if (error) throw error;
}
