import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { requireSupabase } from '@/lib/supabase';
import { nativePushSupported, notificationRuntime, permissionGranted } from '@/lib/notifications';
import { DeviceWriteGate } from './device-write-gate';
import { registerDeviceWithPermission } from './device-registration';

const deviceKey = 'convosquad:push-device';
const enabledKey = (userId: string) => `convosquad:push-enabled:${userId}`;
let identity: Promise<string> | null = null;
const gate = new DeviceWriteGate();
export function pauseDeviceRegistration(userId: string) { gate.pause(userId); }
async function installationId() {
  if (!identity) identity = (async () => {
    const existing = await AsyncStorage.getItem(deviceKey);
    if (existing) return existing;
    const { randomUUID } = await import('expo-crypto');
    const id = randomUUID(); await AsyncStorage.setItem(deviceKey, id); return id;
  })().catch(error => { identity = null; throw error; });
  return identity;
}
async function currentUser(userId: string, includePaused = false) {
  const { data, error } = await requireSupabase().auth.getSession();
  return !error && data.session?.user.id === userId && (includePaused || gate.allowed(userId));
}
export async function deactivateInstallation(userId: string, unlink = false) {
  gate.pause(userId);
  return gate.run(() => deactivate(userId, unlink));
}
async function deactivate(userId: string, unlink: boolean) {
  if (Platform.OS === 'web') return;
  const id = await AsyncStorage.getItem(deviceKey);
  if (id) {
    if (!await currentUser(userId, true)) throw new Error('No se pudo verificar la sesión para desvincular este dispositivo. Recupera la conexión e inténtalo de nuevo.');
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const { error } = await requireSupabase().rpc('deactivate_push_device', { p_device_id: id, p_unlink: unlink }).abortSignal(controller.signal);
      if (error) throw new Error('No se pudo desactivar este dispositivo. Comprueba la conexión antes de cerrar sesión.');
    } finally { clearTimeout(timeout); }
  }
  await AsyncStorage.removeItem(enabledKey(userId));
}
export async function enableInstallation(userId: string, prompt = true) {
  if (!nativePushSupported()) return 'unsupported' as const;
  if (prompt) gate.resume(userId);
  const { Notifications, projectId } = await notificationRuntime();
  return registerDeviceWithPermission({
    supported: true, current: () => currentUser(userId),
    permission: async () => permissionGranted(await Notifications.getPermissionsAsync()),
    requestPermission: async () => permissionGranted(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } })),
    token: async () => (await Notifications.getExpoPushTokenAsync({ projectId })).data,
    register: token => gate.run(async () => {
      const id = await installationId();
      if (!await currentUser(userId)) return;
      const { error } = await requireSupabase().rpc('register_push_device', { p_device_id: id, p_expo_push_token: token, p_platform: Platform.OS });
      if (error) throw new Error('No se pudo registrar este dispositivo. Comprueba la configuración y la conexión.');
      await AsyncStorage.setItem(enabledKey(userId), '1');
    }),
    deactivate: () => deactivateInstallation(userId),
  }, prompt);
}
export async function syncInstallation(userId: string) {
  if (!nativePushSupported() || await AsyncStorage.getItem(enabledKey(userId)) !== '1') return;
  return enableInstallation(userId, false);
}
