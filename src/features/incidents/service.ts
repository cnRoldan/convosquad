import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import type { Tables } from '@/types/database';
import type { IncidentKind } from './model';

export type PlayerIncident = Tables<'player_incidents'>;
export async function listPlayerIncidents(clubId: string, activeOnly = true, callId?: string, offset = 0) {
  return unwrap(await requireSupabase().rpc('list_player_incidents', {
    p_club_id: clubId, p_active_only: activeOnly, p_offset: offset, ...(callId ? { p_call_up_id: callId } : {}),
  }));
}
export async function recordPlayerIncident(callId: string, entryId: string, kind: IncidentKind, note: string): Promise<PlayerIncident> {
  return unwrap(await requireSupabase().rpc('record_player_incident', { p_call_up_id: callId, p_entry_id: entryId, p_kind: kind, p_note: note })) as unknown as PlayerIncident;
}
export async function deletePlayerIncident(incidentId: string): Promise<void> {
  const { error } = await requireSupabase().rpc('delete_player_incident', { p_incident_id: incidentId });
  if (error) throw error;
}
export function incidentError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'P0041') return 'Solo puedes registrar incidencias durante el plazo de valoración de la última convocatoria finalizada.';
  if (code === '23505') return 'Ya se registró este tipo de incidencia para este jugador en esta convocatoria.';
  if (code === '42501') return 'Solo los capitanes del club pueden registrar y consultar incidencias de su plantilla.';
  return 'No se pudo registrar la incidencia. Revisa los datos y vuelve a intentarlo.';
}
