import { t, useLanguage } from '@/features/i18n/runtime';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import type { PendingInvitation } from './links';
import { pendingInviteStorageKey, serializeInvitation, storedInvitation } from './pending-storage';

type PendingInviteContextValue = {
  pendingInvite: PendingInvitation | null;
  isRestoring: boolean;
  rememberInvite: (invitation: PendingInvitation) => void;
  clearInvite: () => void;
};
const PendingInviteContext = createContext<PendingInviteContextValue | null>(null);
function store(invitation: PendingInvitation | null) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (invitation) window.sessionStorage.setItem(pendingInviteStorageKey, serializeInvitation(invitation));
    else window.sessionStorage.removeItem(pendingInviteStorageKey);
  } catch { /* Storage may be blocked; the current in-memory flow still works. */ }
}
export function PendingInviteProvider({ children }: PropsWithChildren) {
  useLanguage();
  const [pendingInvite, setPendingInvite] = useState<PendingInvitation | null>(null);
  const [isRestoring, setIsRestoring] = useState(Platform.OS === 'web');
  useEffect(() => {
    let active = true;
    async function restore() {
      if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
      try {
        const invitation = storedInvitation(window.sessionStorage.getItem(pendingInviteStorageKey));
        if (!invitation) window.sessionStorage.removeItem(pendingInviteStorageKey);
        return invitation;
      } catch { return null; }
    }
    void restore().then(invitation => {
      if (!active) return;
      setPendingInvite(invitation);
      setIsRestoring(false);
    });
    return () => { active = false; };
  }, []);
  const rememberInvite = useCallback((invitation: PendingInvitation) => { setPendingInvite(invitation); store(invitation); }, []);
  const clearInvite = useCallback(() => { setPendingInvite(null); store(null); }, []);
  return <PendingInviteContext.Provider value={{ pendingInvite, isRestoring, rememberInvite, clearInvite }}>{children}</PendingInviteContext.Provider>;
}
export function usePendingInvite() {
  const context = useContext(PendingInviteContext);
  if (!context) throw new Error(t('usePendingInvite requiere PendingInviteProvider'));
  return context;
}
