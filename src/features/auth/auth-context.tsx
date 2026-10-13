import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  isDemo: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setLoading] = useState(Boolean(supabase));
  const [isDemo, setDemo] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let authEventReceived = false;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;
      if (active) { setSession(nextSession); setLoading(false); }
    });
    void client.auth.getSession().then(({ data }) => {
      if (active && !authEventReceived) { setSession(data.session); setLoading(false); }
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

  const enterDemo = useCallback(() => setDemo(true), []);
  const exitDemo = useCallback(() => setDemo(false), []);
  async function signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setSession(null);
    setDemo(false);
  }

  return <AuthContext.Provider value={{ session, isLoading, isDemo, enterDemo, exitDemo, signOut }}>
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requiere AuthProvider');
  return context;
}
