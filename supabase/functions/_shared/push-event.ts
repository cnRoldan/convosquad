import { createHash, timingSafeEqual } from 'node:crypto';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PushEventInput = { clubId: string; callUpId: string; eventKey: string; kind: 'published' | 'pending' };
export function parsePushEvent(data: unknown): PushEventInput | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (Object.keys(data).some(key => !['clubId','callUpId','eventKey','kind'].includes(key))) return null;
  if (!('clubId' in data) || typeof data.clubId !== 'string' || !uuid.test(data.clubId) || !('callUpId' in data) || typeof data.callUpId !== 'string' || !uuid.test(data.callUpId)) return null;
  if (!('eventKey' in data) || typeof data.eventKey !== 'string' || !data.eventKey.trim() || data.eventKey.length > 200 || !('kind' in data) || (data.kind !== 'published' && data.kind !== 'pending')) return null;
  return { clubId: data.clubId.toLowerCase(), callUpId: data.callUpId.toLowerCase(), eventKey: data.eventKey, kind: data.kind };
}
export function authorizedWorker(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}
export function pushMessage(event: PushEventInput, token: string) {
  return {
    to: token, title: event.kind === 'published' ? 'Nueva convocatoria' : 'Confirma tu disponibilidad',
    body: event.kind === 'published' ? 'Tu club tiene una convocatoria. Abre ConvoSquad para consultarla.' : 'Hay una convocatoria pendiente de tu respuesta. Abre ConvoSquad para responder.',
    channelId: 'call-ups', sound: 'default',
    data: { type: 'call_up', clubId: event.clubId, callUpId: event.callUpId },
  };
}
