import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';

export async function listClubInvitations(clubId: string) {
  return unwrap(await requireSupabase().from('club_invitations')
    .select('id, club_id, expires_at, revoked_at, max_uses, uses, created_by, created_at')
    .eq('club_id', clubId).order('created_at'));
}

export async function createClubInvitation(clubId: string, expiresAt: string, maxUses = 1) {
  return unwrap(await requireSupabase().rpc('create_club_invitation', { p_club_id: clubId, p_expires_at: expiresAt, p_max_uses: maxUses }).single());
}

export async function revokeClubInvitation(invitationId: string) {
  const { error } = await requireSupabase().rpc('revoke_club_invitation', { p_invitation_id: invitationId });
  if (error) throw error;
}

export async function redeemClubInvitation(clubId: string, token: string) {
  return unwrap(await requireSupabase().rpc('redeem_club_invitation', { p_club_id: clubId, p_token: token }).single());
}
