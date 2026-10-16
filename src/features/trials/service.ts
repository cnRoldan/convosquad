import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import type { RosterCategory } from '@/features/players/categories';
export async function listTrials(clubId: string, all = false, includePrivateNotes = false) {
  let query = requireSupabase().from('club_trials').select('*').eq('club_id', clubId).order('sort_order').order('id');
  if (!all) query = query.eq('status', 'active');
  const trials = unwrap(await query);
  if (!includePrivateNotes) return trials;
  const notes = unwrap(await requireSupabase().from('club_trial_notes').select('trial_id,notes').eq('club_id', clubId));
  return trials.map(trial => ({ ...trial, notes: notes.find(note => note.trial_id === trial.id)?.notes ?? null }));
}
export async function saveTrial(clubId: string, input: { name: string; notes: string | null; phone: string | null }, id?: string) {
  return unwrap(await requireSupabase().rpc('save_club_trial_with_contact', {
    p_club_id: clubId, p_name: input.name,
    ...(input.notes ? { p_notes: input.notes } : {}),
    ...(input.phone ? { p_phone: input.phone } : {}),
    ...(id ? { p_trial_id: id } : {}),
  }).single());
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
