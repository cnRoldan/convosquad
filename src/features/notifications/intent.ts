const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PushIntent = { clubId: string; callUpId: string };
export function readPushIntent(data: unknown): PushIntent | null {
  if (!data || typeof data !== 'object' || !('type' in data) || data.type !== 'call_up' || !('clubId' in data) || !('callUpId' in data)) return null;
  if (typeof data.clubId !== 'string' || typeof data.callUpId !== 'string' || !uuid.test(data.clubId) || !uuid.test(data.callUpId)) return null;
  return { clubId: data.clubId.toLowerCase(), callUpId: data.callUpId.toLowerCase() };
}
export function notificationDestination(intent: PushIntent, signedIn: boolean, clubs: readonly { id: string }[], call: { club_id: string; status: string } | null) {
  if (!signedIn) return 'login';
  if (!clubs.some(club => club.id === intent.clubId)) return 'no-membership';
  if (!call || call.club_id !== intent.clubId) return 'unavailable';
  if (call.status === 'cancelled') return 'cancelled';
  return 'call-up';
}
