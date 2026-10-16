import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import type { RosterCategory } from '@/features/players/categories';
export async function listTrials(clubId: string, all = false) {
  let query = requireSupabase().from('club_trials').select('*').eq('club_id', clubId).order('sort_order').order('id');
  if (!all) query = query.eq('status', 'active');
  return unwrap(await query);
}
export async function saveTrial(clubId: string, input: { name: string; notes: string | null }, id?: string) {
  const values = { ea_id: input.name, jersey_number: null, position: null, notes: input.notes };
  return unwrap(await (id ? requireSupabase().from('club_trials').update(values).eq('id', id).eq('club_id', clubId)
    : requireSupabase().from('club_trials').insert({ club_id: clubId, ...values })).select().single());
}
export async function withdrawTrial(id: string) { return unwrap(await requireSupabase().rpc('withdraw_trial', { p_trial_id: id }).single()); }
export async function promoteTrial(id: string, category: RosterCategory, existingId?: string) {
  return unwrap(await requireSupabase().rpc('promote_trial', { p_trial_id: id, p_category: category, ...(existingId ? { p_existing_player_id: existingId } : {}) }).single());
}
export async function reorderTrials(clubId: string, ids: string[]) {
  const { error } = await requireSupabase().rpc('reorder_trials', { p_club_id: clubId, p_ids: ids }); if (error) throw error;
}

export async function listTrialContacts(clubId: string) {
  return unwrap(await requireSupabase().from('club_trial_contacts').select('trial_id,phone').eq('club_id', clubId));
}

export async function addCallUpTrial(callUpId: string, name: string, notes: string | null) {
  return unwrap(await requireSupabase().rpc('add_call_up_trial', { p_call_up_id: callUpId, p_name: name, ...(notes ? { p_notes: notes } : {}) }));
}

export async function addCallUpTrialWithContact(callUpId: string, name: string, phone: string | null) {
  return unwrap(await requireSupabase().rpc('add_call_up_trial_with_contact', { p_call_up_id: callUpId, p_name: name, ...(phone ? { p_phone: phone } : {}) }));
}
export async function removeCallUpTrial(trialId: string) {
  const { error } = await requireSupabase().rpc('remove_call_up_trial', { p_trial_id: trialId });
  if (error) throw error;
}
