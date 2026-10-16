import { useLanguage } from '@/features/i18n/runtime';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { router, useRootNavigationState } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nativePushSupported, notificationRuntime } from '@/lib/notifications';
import { useAuth } from '@/features/auth/auth-context';
import { beginDeviceSession, syncInstallation } from './device-service';
import { usePendingPush } from './pending-push-context';
import { readNotificationResponse } from './actions';

export function NativePushLifecycle() {
  const language = useLanguage();
  const { session, isDemo } = useAuth(); const userId = session?.user.id;
  const { rememberPush } = usePendingPush(); const navigation = useRootNavigationState();
  const [open, setOpen] = useState<string | null>(null); const navigated = useRef<string | null>(null);
  useEffect(() => {
    if (open && open !== navigated.current && navigation?.key) { navigated.current = open; router.push('/notification'); }
  }, [open, navigation?.key]);
  useEffect(() => {
    if (!nativePushSupported() || isDemo) return;
    let active = true;
    if (userId) beginDeviceSession(userId);
    const subscriptions: { remove: () => void }[] = [];
    let responding = Promise.resolve();
    const sync = () => { if (active && userId) void syncInstallation(userId).catch(() => undefined); };
    void notificationRuntime().then(async ({ Notifications }) => {
      if (!active) return;
      Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
      const receive = (response: import('expo-notifications').NotificationResponse) => {
        responding = responding.then(async () => {
          if (!active) return;
          const intent = readNotificationResponse(response.notification.request.content.data, response.actionIdentifier, response.notification.request.identifier, Notifications.DEFAULT_ACTION_IDENTIFIER); if (!intent) return;
          if (intent.response && Platform.OS === 'android') {
            const { handleAndroidNotificationResponse } = await import('./background-action-service');
            await handleAndroidNotificationResponse(response); return;
          }
          const id = `${response.notification.request.identifier}:${response.actionIdentifier}`;
          if (await AsyncStorage.getItem('convosquad:last-push-response') === id || !active) return;
          rememberPush(intent); setOpen(id);
          await AsyncStorage.setItem('convosquad:last-push-response', id);
        }).catch(() => undefined);
      };
      subscriptions.push(Notifications.addNotificationResponseReceivedListener(receive));
      subscriptions.push(Notifications.addPushTokenListener(sync));
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last && (Platform.OS !== 'android' || last.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER)) receive(last);
      if (userId && AppState.currentState === 'active') void syncInstallation(userId, true).catch(() => undefined);
    }).catch(() => undefined);
    subscriptions.push(AppState.addEventListener('change', state => { if (state === 'active' && active && userId) void syncInstallation(userId, true).catch(() => undefined); }));
    return () => { active = false; subscriptions.forEach(subscription => subscription.remove()); };
  }, [userId, isDemo, rememberPush, language]);
  return null;
}
