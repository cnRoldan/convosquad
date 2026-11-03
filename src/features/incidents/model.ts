import type { Lineup } from '../lineups/model';

export const incidentKinds = [
  { value: 'late', label: 'Retraso' },
  { value: 'no_show', label: 'No se presentó' },
  { value: 'left_early', label: 'Abandonó antes de terminar' },
  { value: 'other', label: 'Otra incidencia' },
] as const;
export type IncidentKind = typeof incidentKinds[number]['value'];
export function incidentLabel(kind: string) { return incidentKinds.find(item => item.value === kind)?.label ?? 'Otra incidencia'; }
type TimedIncident = { created_at: string; expires_at: string; player_id: string | null };
export function activeIncidents<T extends TimedIncident>(incidents: readonly T[], now: number): T[] {
  return incidents.filter(incident => Date.parse(incident.created_at) <= now && now < Date.parse(incident.expires_at));
}
export function lineupIncidents<T extends TimedIncident>(lineup: Lineup | null, incidents: readonly T[], now: number): T[] {
  const selected = new Set(lineup?.slots.flatMap(slot => slot.playerId ? [slot.playerId] : []));
  return activeIncidents(incidents, now).filter(incident => incident.player_id && selected.has(incident.player_id));
}
