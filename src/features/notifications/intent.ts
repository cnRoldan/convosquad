const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PushIntent = { clubId: string; callUpId: string; response?: { availability: 'available' | 'unavailable' | 'backup'; userId: string; actionId: string } };
export function readPushIntent(data: unknown): PushIntent | null {
  if (!data || typeof data !== 'object' || !('type' in data) || data.type !== 'call_up' || !('clubId' in data) || !('callUpId' in data)) return null;
  if (typeof data.clubId !== 'string' || typeof data.callUpId !== 'string' || !uuid.test(data.clubId) || !uuid.test(data.callUpId)) return null;
  const intent: PushIntent = { clubId: data.clubId.toLowerCase(), callUpId: data.callUpId.toLowerCase() };
  if ('response' in data) {
    const response = data.response;
    if (!response || typeof response !== 'object' || !('availability' in response) || !('userId' in response) || !('actionId' in response)
      || (response.availability !== 'available' && response.availability !== 'unavailable' && response.availability !== 'backup')
      || typeof response.userId !== 'string' || !uuid.test(response.userId) || typeof response.actionId !== 'string'
      || !response.actionId || response.actionId.length > 200) return null;
    intent.response = { availability: response.availability, userId: response.userId.toLowerCase(), actionId: response.actionId };
  }
  return intent;
}
export function notificationDestination(intent: PushIntent, signedIn: boolean, clubs: readonly { id: string }[], call: { club_id: string; status: string } | null) {
  if (!signedIn) return 'login';
  if (!clubs.some(club => club.id === intent.clubId)) return 'no-membership';
  if (!call || call.club_id !== intent.clubId) return 'unavailable';
  if (call.status === 'cancelled') return 'cancelled';
  return 'call-up';
}
