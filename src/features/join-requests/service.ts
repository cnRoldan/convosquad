import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';

export async function listJoinRequests(clubId: string) {
  return unwrap(await requireSupabase().from('join_requests').select('*, profiles!join_requests_user_id_fkey(username)').eq('club_id', clubId).eq('status', 'pending').order('created_at'));
}

export async function requestToJoin(clubId: string) {
  return unwrap(await requireSupabase().rpc('request_to_join', { p_club_id: clubId }).single());
}

export async function reviewJoinRequest(requestId: string, approve: boolean, playerId?: string) {
  return unwrap(await requireSupabase().rpc('review_join_request', {
    p_request_id: requestId, p_approve: approve, ...(playerId ? { p_player_id: playerId } : {}),
  }).single());
}

export async function listMyJoinRequests(userId: string) {
  return unwrap(await requireSupabase().from('join_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }));
}
