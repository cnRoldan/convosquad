import { readPushIntent, type PushIntent } from './intent.ts';

export const availabilityCategory = 'call_up_availability';
export const notificationActions = [
  { identifier: 'availability-available', buttonTitle: 'Disponible', availability: 'available' },
  { identifier: 'availability-unavailable', buttonTitle: 'No disponible', availability: 'unavailable' },
  { identifier: 'availability-backup', buttonTitle: 'Backup', availability: 'backup' },
] as const;

export function readNotificationResponse(data: unknown, actionId: string, notificationId: string, defaultActionId: string): PushIntent | null {
  const intent = readPushIntent(data);
  if (!intent) return null;
  if (intent.membership || intent.joinRequest) return actionId === defaultActionId ? intent : null;
  if (actionId === defaultActionId) return { clubId: intent.clubId, callUpId: intent.callUpId, ...(intent.cancelled ? { cancelled: true } : {}) };
  if (intent.cancelled) return null;
  const action = notificationActions.find(item => item.identifier === actionId);
  if (!action || !data || typeof data !== 'object' || !('userId' in data) || typeof data.userId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.userId)
    || !notificationId || notificationId.length > 160) return null;
  return { ...intent, response: { availability: action.availability, userId: data.userId.toLowerCase(), actionId: `${notificationId}:${actionId}` } };
}
