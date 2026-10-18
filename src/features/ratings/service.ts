import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';

export type RatingChoice = '' | 'not_selected' | `${number}`;
export type RatingChange = { entry_id: string; score?: number; not_selected?: boolean; clear?: boolean; expected_updated_at: string | null };
export async function listRatings(callId: string) {
  return unwrap(await requireSupabase().from('player_ratings').select('*').eq('call_up_id', callId));
}
export async function saveRatings(callId: string, changes: RatingChange[]) {
  return unwrap(await requireSupabase().rpc('save_player_ratings', { p_call_up_id: callId, p_ratings: changes }));
}
export async function listRatingCalls(clubId: string) {
  return unwrap(await requireSupabase().rpc('list_rating_call_ups', { p_club_id: clubId }));
}
export async function getPerformance(clubId: string, period: '7d' | '1m' | '3m') {
  return unwrap(await requireSupabase().rpc('get_player_performance', { p_club_id: clubId, p_period: period }));
}
export async function getRatingHistory(clubId: string, playerId: string) {
  return unwrap(await requireSupabase().rpc('get_player_rating_history', { p_club_id: clubId, p_player_id: playerId }));
}
export function ratingError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'P0041') return 'La valoración no está disponible: comprueba la hora, el estado de la convocatoria y el límite de tres meses.';
  if (code === '40001') return 'Otro capitán ha cambiado estas valoraciones. Recarga antes de guardar.';
  if (code === '42501') return 'Solo los capitanes de este club pueden gestionar las valoraciones.';
  return 'No se pudieron guardar las valoraciones. Revisa los datos y vuelve a intentarlo.';
}
