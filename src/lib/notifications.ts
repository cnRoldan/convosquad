import { availabilityCategory, notificationActions } from '@/features/notifications/actions';
import { ensureBackgroundNotificationTask } from '@/features/notifications/background-task';
import { nativePushSupported } from './push-support';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export { nativePushSupported } from './push-support';

export async function notificationRuntime() {
  if (!nativePushSupported()) throw new Error('Usa un dispositivo físico con una compilación EAS. Push no está disponible en web, simuladores o Expo Go.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (typeof projectId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) throw new Error('Vincula el proyecto EAS y configura EXPO_PUBLIC_EAS_PROJECT_ID antes de activar notificaciones.');
  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('call-ups', {
    name: 'Convocatorias', importance: Notifications.AndroidImportance.DEFAULT,
  });
  await ensureBackgroundNotificationTask();
  await Notifications.setNotificationCategoryAsync(availabilityCategory, notificationActions.map(({ identifier, buttonTitle }) => ({ identifier, buttonTitle, options: { opensAppToForeground: Platform.OS !== 'android', isAuthenticationRequired: true } })));
  return { Notifications, projectId };
}
export function permissionGranted(permission: Awaited<ReturnType<typeof import('expo-notifications').getPermissionsAsync>>) {
  return permission.granted || permission.ios?.status === 3;
}
