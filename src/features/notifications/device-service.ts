import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { requireSupabase } from '@/lib/supabase';
import { nativePushSupported, notificationRuntime, permissionGranted } from '@/lib/notifications';
import { DeviceWriteGate } from './device-write-gate';
import { registerDeviceWithPermission, requestDevicePermission } from './device-registration';
import { deactivateOwnedDevice } from './device-deactivation';

const deviceKey = 'convosquad:push-device';
const permissionRequestedKey = 'convosquad:push-permission-requested';
const enabledKey = (userId: string) => `convosquad:push-enabled:${userId}`;
let identity: Promise<string> | null = null;
const gate = new DeviceWriteGate();
const synchronizing = new Map<string, Promise<unknown>>();
export function beginDeviceSession(userId: string) { gate.resume(userId); }
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
async function deactivate(userId: string, unlink: boolean, rememberChoice = true) {
  if (Platform.OS === 'web') return;
  const id = await AsyncStorage.getItem(deviceKey);
  if (id) {
    if (!await currentUser(userId, true)) throw new Error('No se pudo verificar la sesión para desvincular este dispositivo. Recupera la conexión e inténtalo de nuevo.');
    await deactivateOwnedDevice(requireSupabase(), userId, id, unlink);
  }
  if (unlink && await AsyncStorage.getItem(enabledKey(userId)) !== '0') await AsyncStorage.removeItem(enabledKey(userId));
  else if (!unlink && rememberChoice) await AsyncStorage.setItem(enabledKey(userId), '0');
}
export async function enableInstallation(userId: string, prompt = true, automatic = false) {
  if (!nativePushSupported()) return 'unsupported' as const;
  if (prompt && !automatic) gate.resume(userId);
  const { Notifications, projectId } = await notificationRuntime();
  return registerDeviceWithPermission({
    supported: true, current: () => currentUser(userId),
    permission: async () => permissionGranted(await Notifications.getPermissionsAsync()),
    requestPermission: () => requestDevicePermission({
      automatic,
      previouslyRequested: async () => await AsyncStorage.getItem(permissionRequestedKey) === '1',
      current: () => currentUser(userId),
      canAskAgain: async () => (await Notifications.getPermissionsAsync()).canAskAgain,
      markRequested: () => AsyncStorage.setItem(permissionRequestedKey, '1'),
      request: async () => permissionGranted(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } })),
    }),
    token: async () => (await Notifications.getExpoPushTokenAsync({ projectId })).data,
    register: token => gate.run(async () => {
      const id = await installationId();
      if (!await currentUser(userId)) return;
      const { error } = await requireSupabase().rpc('register_push_device', { p_device_id: id, p_expo_push_token: token, p_platform: Platform.OS });
      if (error) throw new Error('No se pudo registrar este dispositivo. Comprueba la configuración y la conexión.');
      await AsyncStorage.setItem(enabledKey(userId), '1');
    }),
    deactivate: () => gate.run(() => deactivate(userId, false, false)),
  }, prompt);
}
export async function syncInstallation(userId: string, prompt = false) {
  if (!nativePushSupported()) return;
  const existing = synchronizing.get(userId);
  if (existing) return existing;
  const operation = (async () => {
    if (await AsyncStorage.getItem(enabledKey(userId)) === '0' || !await currentUser(userId)) return;
    return enableInstallation(userId, prompt, true);
  })().finally(() => synchronizing.delete(userId));
  synchronizing.set(userId, operation);
  return operation;
}
