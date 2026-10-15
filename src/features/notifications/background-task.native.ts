import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { nativePushSupported } from '@/lib/push-support';
import { handleAndroidNotificationResponse } from './background-action-service';

const taskName = 'convosquad-notification-actions';
if (Platform.OS === 'android' && nativePushSupported() && !TaskManager.isTaskDefined(taskName)) {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(taskName, async ({ data, error }) => {
    if (error || !data || !('actionIdentifier' in data)) return;
    await handleAndroidNotificationResponse(data);
  });
}
export async function ensureBackgroundNotificationTask() {
  if (Platform.OS !== 'android' || !nativePushSupported()) return;
  if (!await TaskManager.isAvailableAsync()) throw new Error('Las respuestas en segundo plano no están disponibles en esta compilación.');
  if (!await TaskManager.isTaskRegisteredAsync(taskName)) await Notifications.registerTaskAsync(taskName);
}
void ensureBackgroundNotificationTask().catch(() => undefined);
