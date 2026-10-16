import { t, useLanguage } from '@/features/i18n/runtime';
import { clubCrestCache } from '@/features/clubs/crest';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RecoveryState } from './recovery-state';

import { deactivateInstallation, pauseDeviceRegistration } from '@/features/notifications/device-service';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  isDemo: boolean;
  isRecovery: boolean;
  getRecoveryMode: () => boolean;
  enterDemo: () => void;
  exitDemo: () => void;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  useLanguage();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setLoading] = useState(Boolean(supabase));
  const [isDemo, setDemo] = useState(false);
  const [isRecovery, setRecovery] = useState(false);
  const recoveryRef = useRef<RecoveryState | null>(null);
  if (recoveryRef.current == null) recoveryRef.current = new RecoveryState(AsyncStorage, `convosquad:recovery:${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}`, setRecovery);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let authEventReceived = false;
    let eventVersion = 0;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, nextSession) => {
      authEventReceived = true;
      const version = ++eventVersion;
      if (!active) return;
      // Only storage work here: awaiting Auth methods inside this listener can deadlock.
      const restoring = recoveryRef.current!.handle(event, nextSession);
      if (event === 'PASSWORD_RECOVERY') setDemo(false);
      if (event === 'INITIAL_SESSION') {
        void restoring.then(() => {
          if (active && version === eventVersion) { setSession(nextSession); setLoading(false); }
        });
      } else { setSession(nextSession); setLoading(false); }
    });
    void client.auth.getSession().then(async ({ data }) => {
      if (active && !authEventReceived) {
        await recoveryRef.current!.handle('INITIAL_SESSION', data.session);
        if (active && !authEventReceived) { setSession(data.session); setLoading(false); }
      }
    }).catch(() => { if (active) setLoading(false); });
    const appState = Platform.OS !== 'web' ? AppState.addEventListener('change', (state) => {
      if (state === 'active') client.auth.startAutoRefresh(); else client.auth.stopAutoRefresh();
    }) : null;
    if (Platform.OS !== 'web' && AppState.currentState === 'active') client.auth.startAutoRefresh();
    return () => {
      active = false;
      subscription.unsubscribe();
      appState?.remove();
      if (Platform.OS !== 'web') client.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => () => { clubCrestCache.clear(); }, [session?.user.id]);

  const enterDemo = useCallback(() => setDemo(true), []);
  const exitDemo = useCallback(() => setDemo(false), []);
  const getRecoveryMode = useCallback(() => recoveryRef.current?.current ?? false, []);
  async function signOut() {
    if (session?.user.id) { pauseDeviceRegistration(session.user.id); await deactivateInstallation(session.user.id, true); }
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setSession(null);
    await recoveryRef.current!.handle('SIGNED_OUT', null);
    setDemo(false);
  }

  return <AuthContext.Provider value={{ session, isLoading, isDemo, isRecovery, getRecoveryMode, enterDemo, exitDemo, signOut }}>
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error(t("useAuth requiere AuthProvider"));
  return context;
}
