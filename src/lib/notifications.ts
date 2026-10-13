import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function requestPushToken(): Promise<string> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    throw new Error('Las notificaciones push requieren un dispositivo iOS o Android físico.');
  }
  if (Constants.executionEnvironment === 'storeClient') {
    throw new Error('Usa una compilación de desarrollo de EAS para probar notificaciones push.');
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Vincula el proyecto con EAS antes de registrar notificaciones.');

  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Convocatorias',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') throw new Error('No se ha concedido permiso para notificaciones.');

  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}
