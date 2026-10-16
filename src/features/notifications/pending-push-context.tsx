import { t, useLanguage } from '@/features/i18n/runtime';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readPushIntent } from './intent';
import type { PushIntent } from './intent';
const key = 'convosquad:pending-push';
const Context = createContext<{ pendingPush: PushIntent | null; rememberPush: (intent: PushIntent) => void; clearPush: () => void } | null>(null);
export function PendingPushProvider({ children }: PropsWithChildren) {
  useLanguage();
  const [pendingPush, setPendingPush] = useState<PushIntent | null>(null);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web' || changed) return;
    let active = true;
    void AsyncStorage.getItem(key).then(raw => {
      if (active && raw) { try { setPendingPush(readPushIntent(JSON.parse(raw))); } catch { setPendingPush(null); } }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [changed]);
  const rememberPush = useCallback((intent: PushIntent) => {
    setChanged(true); setPendingPush(intent);
    if (Platform.OS !== 'web') void AsyncStorage.setItem(key, JSON.stringify({ type: 'call_up', ...intent })).catch(() => undefined);
  }, []);
  const clearPush = useCallback(() => {
    setChanged(true); setPendingPush(null);
    if (Platform.OS !== 'web') void AsyncStorage.removeItem(key).catch(() => undefined);
  }, []);
  return <Context.Provider value={{ pendingPush, rememberPush, clearPush }}>{children}</Context.Provider>;
}
export function usePendingPush() {
  const context = useContext(Context); if (!context) throw new Error(t("Falta PendingPushProvider")); return context;
}
