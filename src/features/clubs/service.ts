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

export async function searchPublicClubs(query: string) {
  const safeQuery = query.trim().replace(/[%_]/g, '').slice(0, 80);
  return unwrap(await requireSupabase().from('club_directory').select('club_id, name, description').ilike('name', `%${safeQuery}%`).limit(50));
}

export async function listClubMembers(clubId: string) {
  return unwrap(await requireSupabase().from('club_members').select('*').eq('club_id', clubId).eq('is_active', true));
}
