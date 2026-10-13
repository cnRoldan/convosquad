import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';

export async function getMyProfile(userId: string) {
  return unwrap(await requireSupabase().from('profiles').select('*').eq('id', userId).single());
}
