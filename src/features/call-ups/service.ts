import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import type { Enums } from '@/types/database';

export async function listCallUps(clubId: string) {
  return unwrap(await requireSupabase().from('call_ups').select('*').eq('club_id', clubId).order('starts_at'));
}

export async function listCallUpPlayers(callUpId: string) {
  return unwrap(await requireSupabase().from('call_up_players').select('*').eq('call_up_id', callUpId).order('category_snapshot').order('sort_order_snapshot').order('id'));
}

export async function createCallUp(clubId: string, startsAt: string, status: 'draft' | 'open' = 'draft', lastNoticeAt: string | null = null, closesAt: string | null = null, endsAt: string | null = null, ratingsEnabled = true) {
  return unwrap(await requireSupabase().rpc('create_call_up_with_end', { p_club_id: clubId, p_starts_at: startsAt, p_status: status, ...(lastNoticeAt ? { p_last_notice_at: lastNoticeAt } : {}), ...(closesAt ? { p_closes_at: closesAt } : {}), p_ratings_enabled: ratingsEnabled, ...(endsAt ? { p_ends_at: endsAt } : {}) }).single());
}

export async function updateCallUp(callUpId: string, startsAt: string, status: Enums<'call_up_status'>, lastNoticeAt: string | null, closesAt: string | null, endsAt: string, ratingsEnabled: boolean) {
  return unwrap(await requireSupabase().rpc('update_call_up_with_end', { p_call_up_id: callUpId, p_starts_at: startsAt, p_status: status, ...(lastNoticeAt ? { p_last_notice_at: lastNoticeAt } : {}), ...(closesAt ? { p_closes_at: closesAt } : {}), p_ratings_enabled: ratingsEnabled, p_ends_at: endsAt }).single());
}

export async function refreshCallUpRoster(callUpId: string, reopen = false) {
  return unwrap(await requireSupabase().rpc('refresh_call_up_roster', { p_call_up_id: callUpId, p_reopen: reopen }).single());
}

export async function respondToCallUp(entryId: string, availability: Enums<'availability_status'>) {
  return unwrap(await requireSupabase().rpc('respond_to_call_up', { p_call_up_player_id: entryId, p_availability: availability }).single());
}

export async function listCallUpTrials(callUpId: string, includePrivateNotes = false) {
  const trials = unwrap(await requireSupabase().from('call_up_trials').select('*').eq('call_up_id', callUpId).order('sort_order_snapshot').order('id'));
  if (!includePrivateNotes) return trials;
  const notes = unwrap(await requireSupabase().from('call_up_trial_notes').select('trial_id,notes').eq('call_up_id', callUpId));
  return trials.map(trial => ({ ...trial, notes_snapshot: notes.find(note => note.trial_id === trial.id)?.notes ?? null }));
}
export async function listAids(callUpId: string) {
  return unwrap(await requireSupabase().from('call_up_aids').select('*').eq('call_up_id', callUpId).order('sort_order').order('id'));
}
export async function saveAid(clubId: string, callUpId: string, body: string, id?: string) {
  return unwrap(await (id ? requireSupabase().from('call_up_aids').update({ body }).eq('id', id).eq('call_up_id', callUpId)
    : requireSupabase().from('call_up_aids').insert({ club_id: clubId, call_up_id: callUpId, body })).select().single());
}
export async function deleteAid(id: string, callUpId: string) {
  const { error } = await requireSupabase().from('call_up_aids').delete().eq('id', id).eq('call_up_id', callUpId); if (error) throw error;
}
export async function reorderAids(callUpId: string, ids: string[]) {
  const { error } = await requireSupabase().rpc('reorder_aids', { p_call_up_id: callUpId, p_ids: ids }); if (error) throw error;
}

export async function listCurrentCallUps(clubId: string) {
  return unwrap(await requireSupabase().from('call_ups').select('*').eq('club_id', clubId).gt('ends_at', new Date().toISOString()).order('starts_at'));
}
export async function getCallUp(clubId: string, callUpId: string) {
  return unwrap(await requireSupabase().from('call_ups').select('*').eq('club_id', clubId).eq('id', callUpId).single());
}
export async function listCallUpHistory(clubId: string) {
  return unwrap(await requireSupabase().rpc('list_call_up_history', { p_club_id: clubId }));
}

export async function respondFromNotification(clubId: string, callUpId: string, availability: 'available' | 'unavailable' | 'backup', actionId: string) {
  return unwrap(await requireSupabase().rpc('respond_from_notification', { p_club_id: clubId, p_call_up_id: callUpId, p_availability: availability, p_action_id: actionId }).single());
}

export async function restartCallUp(callUpId: string, expectedVersion: number) {
  return unwrap(await requireSupabase().rpc('restart_call_up', { p_call_up_id: callUpId, p_expected_version: expectedVersion }).single());
}

export async function saveAidWithContact(callUpId: string, body: string, phone: string | null, id?: string) {
  return unwrap(await requireSupabase().rpc('save_call_up_aid_with_contact', { p_call_up_id: callUpId, p_body: body, ...(phone ? { p_phone: phone } : {}), ...(id ? { p_aid_id: id } : {}) }));
}

export async function deleteCancelledCallUp(callUpId: string, expectedVersion: number) {
  const { error } = await requireSupabase().rpc('delete_cancelled_call_up', { p_call_up_id: callUpId, p_expected_version: expectedVersion });
  if (error) throw error;
}
