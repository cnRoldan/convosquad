const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PushIntent = { clubId: string; callUpId: string; membership?: true; userId?: string; cancelled?: true; response?: { availability: 'available' | 'unavailable' | 'backup'; userId: string; actionId: string } };
export function readPushIntent(data: unknown): PushIntent | null {
  if (data && typeof data === 'object' && 'type' in data && data.type === 'club_approved') {
    if (!('clubId' in data) || typeof data.clubId !== 'string' || !uuid.test(data.clubId) || !('userId' in data) || typeof data.userId !== 'string' || !uuid.test(data.userId) || 'response' in data) return null;
    return { clubId: data.clubId.toLowerCase(), callUpId: '', membership: true, userId: data.userId.toLowerCase() };
  }
  if (!data || typeof data !== 'object' || !('type' in data) || data.type !== 'call_up' || !('clubId' in data) || !('callUpId' in data)) return null;
  if (typeof data.clubId !== 'string' || typeof data.callUpId !== 'string' || !uuid.test(data.clubId) || !uuid.test(data.callUpId)) return null;
  const intent: PushIntent = { clubId: data.clubId.toLowerCase(), callUpId: data.callUpId.toLowerCase() };
  if (('kind' in data && data.kind === 'cancelled') || ('cancelled' in data && data.cancelled === true)) intent.cancelled = true;
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
  if (!call) return intent.cancelled ? 'cancelled' : 'unavailable';
  if (call.club_id !== intent.clubId) return 'unavailable';
  if (call.status === 'cancelled') return 'cancelled';
  return 'call-up';
}
