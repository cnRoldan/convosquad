import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import type { RosterCategory } from './categories';
import type { ImportPlayer, ImportTrial } from './import-parser';

export async function listPlayers(clubId: string, includeInactive = false) {
  let query = requireSupabase().from('players').select('*').eq('club_id', clubId).order('category').order('sort_order').order('id');
  if (!includeInactive) query = query.eq('is_active', true);
  return unwrap(await query);
}

export async function createPlayer(clubId: string, input: { eaId: string; jerseyNumber?: number; category: RosterCategory }) {
  return unwrap(await requireSupabase().from('players').insert({
    club_id: clubId, ea_id: input.eaId, jersey_number: input.jerseyNumber ?? null, category: input.category,
  }).select().single());
}

export async function updatePlayer(playerId: string, input: { ea_id?: string; jersey_number?: number | null; category?: RosterCategory; is_active?: boolean }) {
  return unwrap(await requireSupabase().from('players').update(input).eq('id', playerId).select().single());
}

export async function setPlayerActivity(clubId: string, playerId: string, isActive: boolean) {
  return unwrap(await requireSupabase().from('players').update({ is_active: isActive })
    .eq('club_id', clubId).eq('id', playerId).select().single());
}

export async function listInactivePlayers(clubId: string) {
  return unwrap(await requireSupabase().from('players').select('*').eq('club_id', clubId)
    .eq('is_active', false).order('category').order('sort_order').order('id'));
}

export async function linkPlayerAccount(playerId: string, userId: string) {
  return unwrap(await requireSupabase().rpc('link_player_account', { p_player_id: playerId, p_user_id: userId }).single());
}

export async function importRoster(clubId: string, players: ImportPlayer[], trials: ImportTrial[]) {
  const result = unwrap(await requireSupabase().rpc('import_roster', { p_club_id: clubId,
    p_players: players.map(player => ({ ea_id: player.eaId, jersey_number: player.jerseyNumber, category: player.category })),
    p_trials: trials.map(trial => ({ ea_id: trial.eaId, jersey_number: trial.jerseyNumber, position: trial.position, notes: trial.notes })),
  }));
  if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.players !== 'number' || typeof result.trials !== 'number') throw new Error('Resultado de importación no válido.');
  return { players: result.players, trials: result.trials };
}
export async function reorderPlayers(clubId: string, category: RosterCategory, ids: string[]) {
  const { error } = await requireSupabase().rpc('reorder_players', { p_club_id: clubId, p_category: category, p_ids: ids });
  if (error) throw error;
}

export async function getPlayer(clubId: string, playerId: string) {
  return unwrap(await requireSupabase().from('players').select('*').eq('club_id', clubId).eq('id', playerId).single());
}
