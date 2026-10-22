import type { PushIntent } from './intent.ts';
import { availabilityLabels, callUpErrorMessage } from '../call-ups/availability.ts';

export type ActionSession = { userId: string; accessToken: string };
export type NotificationVoteIntent = PushIntent & { response: NonNullable<PushIntent['response']> };
export type NotificationActionResult = { saved: boolean; message: string };
export async function performNotificationAction(intent: PushIntent, dependencies: {
  session: () => Promise<ActionSession | null>;
  respond: (intent: NotificationVoteIntent, session: ActionSession) => Promise<keyof typeof availabilityLabels>;
}): Promise<NotificationActionResult> {
  if (!intent.response || intent.cancelled) return { saved: false, message: 'Este aviso no permite votar.' };
  try {
    const session = await dependencies.session();
    if (!session) return { saved: false, message: 'Inicia sesión en ConvoSquad para responder. No se ha guardado tu voto.' };
    if (session.userId !== intent.response.userId) return { saved: false, message: 'Este aviso pertenece a otra cuenta. No se ha guardado tu voto.' };
    const status = await dependencies.respond({ ...intent, response: intent.response }, session);
    return { saved: true, message: `Tu respuesta: ${availabilityLabels[status]}.` };
  } catch (error) {
    return { saved: false, message: callUpErrorMessage(error, 'response') };
  }
}

export async function submitNotificationAction(configuration: { url: string; publishableKey: string }, action: NotificationVoteIntent, session: ActionSession, fetcher: typeof fetch = fetch): Promise<keyof typeof availabilityLabels> {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    // Fijar el JWT evita votar como otra cuenta si cambia la sesión durante la petición.
    const response = await fetcher(`${configuration.url}/rest/v1/rpc/respond_from_notification`, {
      method: 'POST', signal: controller.signal,
      headers: { apikey: configuration.publishableKey, Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/vnd.pgrst.object+json' },
      body: JSON.stringify({ p_club_id: action.clubId, p_call_up_id: action.callUpId, p_availability: action.response.availability, p_action_id: action.response.actionId }),
    });
    const data = await response.json();
    if (!response.ok) throw { code: data?.code };
    if (!data || typeof data.availability !== 'string' || !Object.hasOwn(availabilityLabels, data.availability)) throw new Error('Respuesta no válida');
    return data.availability as keyof typeof availabilityLabels;
  } finally { clearTimeout(timeout); }
}
