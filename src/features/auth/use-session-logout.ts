import { router } from 'expo-router';
import { useClub } from '@/features/clubs/club-context';
import { usePendingInvite } from '@/features/invitations/pending-invite-context';
import { usePendingPush } from '@/features/notifications/pending-push-context';
import { useAuth } from './auth-context';

export function useSessionLogout() {
  const { isDemo, exitDemo, signOut, isSigningOut } = useAuth();
  const { clearClub } = useClub();
  const { clearInvite } = usePendingInvite();
  const { clearPush } = usePendingPush();
  async function logout() {
    if (isDemo) exitDemo(); else await signOut();
    clearClub(); clearInvite(); clearPush();
    router.replace('/');
  }
  return { logout, isSigningOut };
}
