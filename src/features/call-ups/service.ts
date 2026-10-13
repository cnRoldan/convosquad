import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import type { Enums } from '@/types/database';

export async function listCallUps(clubId: string) {
  return unwrap(await requireSupabase().from('call_ups').select('*').eq('club_id', clubId).order('starts_at'));
}

export async function listCallUpPlayers(callUpId: string) {
  return unwrap(await requireSupabase().from('call_up_players').select('*').eq('call_up_id', callUpId).order('ea_id_snapshot'));
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
