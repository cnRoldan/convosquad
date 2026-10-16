import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
export async function listCallUpContacts(callUpId: string) {
  return unwrap(await requireSupabase().from('call_up_contacts').select('id,trial_id,aid_id,phone').eq('call_up_id', callUpId));
}
export async function saveCallUpContact(callUpId: string, kind: 'trial' | 'aid', entryId: string, phone: string | null) {
  const { error } = await requireSupabase().rpc('save_call_up_contact', { p_call_up_id: callUpId, p_kind: kind, p_entry_id: entryId, ...(phone ? { p_phone: phone } : {}) });
  if (error) throw error;
}
