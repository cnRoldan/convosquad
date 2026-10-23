import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import type { Enums, Tables } from '@/types/database';

export async function listMyClubs() {
  return unwrap(await requireSupabase().from('clubs').select('*').order('name'));
}

export async function listMyMemberships(userId: string) {
  return unwrap(await requireSupabase().from('club_members').select('*').eq('user_id', userId).eq('is_active', true));
}

export async function createClub(input: { name: string; description?: string; timezone?: string; isPublic?: boolean }): Promise<Tables<'clubs'>> {
  return unwrap(await requireSupabase().rpc('create_club', {
    p_name: input.name,
    ...(input.description ? { p_description: input.description } : {}),
    p_timezone: input.timezone ?? 'Europe/Madrid',
    p_is_public: input.isPublic ?? false,
  }).single());
}

export async function updateClub(clubId: string, input: { name?: string; description?: string | null; timezone?: string; is_public?: boolean }) {
  return unwrap(await requireSupabase().from('clubs').update(input).eq('id', clubId).select().single());
}

export async function setClubMember(clubId: string, userId: string, role: Enums<'club_role'>, isActive: boolean) {
  return unwrap(await requireSupabase().rpc('set_club_member', { p_club_id: clubId, p_user_id: userId, p_role: role, p_is_active: isActive }).single());
}

export async function leaveClub(clubId: string) {
  const { error } = await requireSupabase().rpc('leave_club', { p_club_id: clubId });
  if (error) throw error;
}

export async function searchPublicClubs(query: string) {
  return unwrap(await requireSupabase().rpc('search_clubs', { p_query: query.trim().slice(0, 80) }));
}

export async function listClubMembers(clubId: string) {
  return unwrap(await requireSupabase().from('club_members').select('*').eq('club_id', clubId).eq('is_active', true));
}

export async function listClubAccounts(clubId: string) {
  return unwrap(await requireSupabase().from('club_members')
    .select('id, user_id, role, profiles!club_members_user_id_fkey(username)')
    .eq('club_id', clubId).eq('is_active', true));
}

export async function getClubSettings(clubId: string) {
  return unwrap(await requireSupabase().from('clubs').select('*').eq('id', clubId).single());
}

export async function deleteClub(clubId: string) {
  const { error } = await requireSupabase().rpc('delete_club', { p_club_id: clubId });
  if (error) throw error;
}
