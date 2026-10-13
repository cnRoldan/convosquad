import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import type { Enums } from '@/types/database';

export async function listPlayers(clubId: string, includeInactive = false) {
  let query = requireSupabase().from('players').select('*').eq('club_id', clubId).order('jersey_number', { nullsFirst: false }).order('ea_id');
  if (!includeInactive) query = query.eq('is_active', true);
  return unwrap(await query);
}

export async function createPlayer(clubId: string, input: { eaId: string; jerseyNumber?: number; position: Enums<'player_position'> }) {
  return unwrap(await requireSupabase().from('players').insert({
    club_id: clubId, ea_id: input.eaId, jersey_number: input.jerseyNumber ?? null, position: input.position,
  }).select().single());
}

export async function updatePlayer(playerId: string, input: { ea_id?: string; jersey_number?: number | null; position?: Enums<'player_position'>; is_active?: boolean }) {
  return unwrap(await requireSupabase().from('players').update(input).eq('id', playerId).select().single());
}

export async function deletePlayer(playerId: string) {
  const { error } = await requireSupabase().from('players').delete().eq('id', playerId);
  if (error) throw error;
}

export async function linkPlayerAccount(playerId: string, userId: string) {
  return unwrap(await requireSupabase().rpc('link_player_account', { p_player_id: playerId, p_user_id: userId }).single());
}

export async function importPlayers(clubId: string, players: { eaId: string; jerseyNumber: number; position: Enums<'player_position'> }[]) {
  return unwrap(await requireSupabase().rpc('import_players', { p_club_id: clubId,
    p_players: players.map((player) => ({ ea_id: player.eaId, jersey_number: player.jerseyNumber, position: player.position })),
  }));
}

export async function getPlayer(clubId: string, playerId: string) {
  return unwrap(await requireSupabase().from('players').select('*').eq('club_id', clubId).eq('id', playerId).single());
}
