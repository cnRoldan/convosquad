import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import type { Enums } from '@/types/database';

export async function listCallUps(clubId: string) {
  return unwrap(await requireSupabase().from('call_ups').select('*').eq('club_id', clubId).order('starts_at'));
}

export async function listCallUpPlayers(callUpId: string) {
  return unwrap(await requireSupabase().from('call_up_players').select('*').eq('call_up_id', callUpId).order('category_snapshot').order('sort_order_snapshot').order('id'));
}

export async function createCallUp(clubId: string, startsAt: string, status: 'draft' | 'open' = 'draft') {
  return unwrap(await requireSupabase().rpc('create_call_up', { p_club_id: clubId, p_starts_at: startsAt, p_status: status }).single());
}

export async function updateCallUp(callUpId: string, startsAt: string, status: Enums<'call_up_status'>) {
  return unwrap(await requireSupabase().rpc('update_call_up', { p_call_up_id: callUpId, p_starts_at: startsAt, p_status: status }).single());
}

export async function respondToCallUp(entryId: string, availability: Enums<'availability_status'>) {
  return unwrap(await requireSupabase().rpc('respond_to_call_up', { p_call_up_player_id: entryId, p_availability: availability }).single());
}

export async function listCallUpTrials(callUpId: string) {
  return unwrap(await requireSupabase().from('call_up_trials').select('*').eq('call_up_id', callUpId).order('sort_order_snapshot').order('id'));
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

export async function listCurrentCallUps(clubId: string, localDate: string) {
  return unwrap(await requireSupabase().from('call_ups').select('*').eq('club_id', clubId).gte('local_date', localDate).order('starts_at'));
}
export async function getCallUp(clubId: string, callUpId: string) {
  return unwrap(await requireSupabase().from('call_ups').select('*').eq('club_id', clubId).eq('id', callUpId).single());
}
export async function listCallUpHistory(clubId: string) {
  return unwrap(await requireSupabase().rpc('list_call_up_history', { p_club_id: clubId }));
}
