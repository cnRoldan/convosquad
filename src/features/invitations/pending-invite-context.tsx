import { t, useLanguage } from '@/features/i18n/runtime';
import { createContext, useCallback, useContext, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { PendingInvitation } from './links';

type PendingInviteContextValue = {
  pendingInvite: PendingInvitation | null;
  rememberInvite: (invitation: PendingInvitation) => void;
  clearInvite: () => void;
};
const PendingInviteContext = createContext<PendingInviteContextValue | null>(null);

export function PendingInviteProvider({ children }: PropsWithChildren) {
  useLanguage();
  const [pendingInvite, setPendingInvite] = useState<PendingInvitation | null>(null);
  const clearInvite = useCallback(() => setPendingInvite(null), []);
  return <PendingInviteContext.Provider value={{ pendingInvite, rememberInvite: setPendingInvite, clearInvite }}>{children}</PendingInviteContext.Provider>;
}
export function usePendingInvite() {
  const context = useContext(PendingInviteContext);
  if (!context) throw new Error(t("usePendingInvite requiere PendingInviteProvider"));
  return context;
}
