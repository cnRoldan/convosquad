import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { requireSupabase, supabase } from '@/lib/supabase';
import { readSupabaseConfiguration } from '@/lib/supabase-config';
import { readNotificationResponse } from './actions';
import { performNotificationAction, submitNotificationAction } from './perform-action';

const inFlight = new Map<string, Promise<void>>();
const handledKey = 'convosquad:last-background-attempt';
export async function handleAndroidNotificationResponse(response: Notifications.NotificationResponse) {
  const intent = readNotificationResponse(response.notification.request.content.data, response.actionIdentifier,
    response.notification.request.identifier, Notifications.DEFAULT_ACTION_IDENTIFIER);
  if (!intent?.response) return;
  const key = `${intent.response.userId}:${intent.response.actionId}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const operation = (async () => {
    if (await AsyncStorage.getItem(handledKey) === key) return;
    await AsyncStorage.setItem(handledKey, key);
    const result = await performNotificationAction(intent, {
      async session() {
        const { data, error } = await requireSupabase().auth.getSession();
        return !error && data.session ? { userId: data.session.user.id, accessToken: data.session.access_token } : null;
      },
      async respond(action, session) {
        const { configuration } = readSupabaseConfiguration(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
        if (!configuration) throw new Error('Configuración incompleta');
        return submitNotificationAction(configuration, action, session);
      },
    });
    if (result.saved) {
      await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => undefined);
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: result.saved ? 'Respuesta guardada' : 'Revisa tu respuesta', body: result.message,
        sound: false, data: { type: 'call_up', clubId: intent.clubId, callUpId: intent.callUpId } }, trigger: null,
    }).catch(() => undefined);
  })().finally(() => {
    inFlight.delete(key);
    if (AppState.currentState !== 'active') supabase?.auth.stopAutoRefresh();
  });
  inFlight.set(key, operation);
  return operation;
}
