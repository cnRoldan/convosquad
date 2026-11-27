import { readInvitation, type PendingInvitation } from './links.ts';
export const pendingInviteStorageKey = 'convosquad:pending-invite';
const maximumAge = 30 * 86400_000;
export function storedInvitation(value: string | null, now = Date.now()): PendingInvitation | null {
  if (!value) return null;
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== 'object' || !('savedAt' in data) || typeof data.savedAt !== 'number'
      || !Number.isFinite(data.savedAt) || data.savedAt > now || now - data.savedAt > maximumAge) return null;
    return readInvitation('clubId' in data ? data.clubId : null, 'token' in data ? data.token : null);
  } catch { return null; }
}
export function serializeInvitation(invitation: PendingInvitation, now = Date.now()) {
  return JSON.stringify({ ...invitation, savedAt: now });
}
