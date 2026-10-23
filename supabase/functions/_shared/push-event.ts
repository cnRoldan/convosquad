import { pushCopy } from './push-language.ts';
import { createHash, timingSafeEqual } from 'node:crypto';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PushEventInput = { clubId: string; callUpId: string | null; eventKey: string; kind: 'published' | 'pending' | 'reminder' | 'vote' | 'cancelled' | 'evaluation' | 'evaluation_deadline' | 'club_approved' | 'club_join_request'; clubName?: string | null; actorEaId?: string | null; availability?: string | null };
export function parsePushEvent(data: unknown): PushEventInput | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (Object.keys(data).some(key => !['clubId','callUpId','eventKey','kind'].includes(key))) return null;
  if (!('clubId' in data) || typeof data.clubId !== 'string' || !uuid.test(data.clubId) || !('callUpId' in data) || typeof data.callUpId !== 'string' || !uuid.test(data.callUpId)) return null;
  if (!('eventKey' in data) || typeof data.eventKey !== 'string' || !data.eventKey.trim() || data.eventKey.length > 200 || !('kind' in data) || (data.kind !== 'published' && data.kind !== 'pending' && data.kind !== 'reminder')) return null;
  return { clubId: data.clubId.toLowerCase(), callUpId: data.callUpId.toLowerCase(), eventKey: data.eventKey, kind: data.kind };
}
export function authorizedWorker(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}
export function pushMessage(event: PushEventInput, token: string, recipientUserId?: string | null, canVote = true, language = 'es') {
  const text = pushCopy(language);
  if (event.kind === 'club_join_request') return {
    to: token, title: text.club_join_request,
    body: `${event.actorEaId?.slice(0, 100) ?? text.player} ${text.joinRequestBody} ${event.clubName?.slice(0, 100) ?? 'ConvoSquad'}. ${text.reviewRequests}`,
    channelId: 'call-ups', sound: 'default',
    data: { type: 'club_join_request', clubId: event.clubId, ...(recipientUserId ? { userId: recipientUserId } : {}) },
  };
  if (event.kind === 'club_approved') return {
    to: token, title: text.club_approved, body: `${event.clubName?.slice(0, 100) ?? 'ConvoSquad'} ${text.admissionBody}`,
    channelId: 'call-ups', sound: 'default',
    data: { type: 'club_approved', clubId: event.clubId, ...(recipientUserId ? { userId: recipientUserId } : {}) },
  };
  return {
    to: token, title: text[event.kind],
    body: event.kind === 'evaluation_deadline' ? text.evaluationDeadlineBody : event.kind === 'evaluation' ? text.evaluationBody : event.kind === 'cancelled' ? text.cancelledBody : event.kind === 'vote'
      ? `${event.actorEaId?.slice(0, 100) ?? text.player} ${text.voted}: ${event.availability === 'available' ? text.available : event.availability === 'unavailable' ? text.unavailable : text.backup}.`
      : event.kind === 'published' ? (canVote ? text.publishedBody : text.readOnly) : event.kind === 'reminder' ? text.reminderBody : text.pendingBody,
    channelId: 'call-ups', sound: 'default', ...(['published', 'pending', 'reminder'].includes(event.kind) && canVote ? { categoryId: 'call_up_availability' } : {}),
    data: { type: 'call_up', clubId: event.clubId, callUpId: event.callUpId, ...(recipientUserId ? { userId: recipientUserId } : {}), ...(event.kind === 'cancelled' ? { kind: 'cancelled' } : {}), ...(event.kind === 'evaluation' || event.kind === 'evaluation_deadline' ? { kind: event.kind } : {}) },
  };
}
