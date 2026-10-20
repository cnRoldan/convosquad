import { createContext, useCallback, useContext, useEffect, useRef, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { startCallUpSync } from '@/features/call-ups/realtime-sync';
import { useResource } from '@/hooks/use-resource';
import { requireSupabase } from '@/lib/supabase';
import { listIncomingJoinRequests, listMyJoinRequests } from './service';

type Requests = { incoming: Awaited<ReturnType<typeof listIncomingJoinRequests>>; outgoing: Awaited<ReturnType<typeof listMyJoinRequests>> };
type RequestsValue = Requests & { isLoading: boolean; error: string | null; refresh: () => void };
const Context = createContext<RequestsValue | null>(null);

export function RequestsProvider({ children }: PropsWithChildren) {
  const { session, isDemo, isRecovery } = useAuth();
  const { ownMemberships, refresh: refreshClubs } = useClub();
  const userId = session?.user.id;
  const clubs = ownMemberships.filter(member => member.role === 'admin').map(member => member.clubId).sort().join(',');
  const enabled = Boolean(userId && !isDemo && !isRecovery);
  const load = useCallback(async () => {
    const [incoming, outgoing] = await Promise.all([listIncomingJoinRequests(clubs ? clubs.split(',') : []), listMyJoinRequests(userId!)]);
    return { incoming, outgoing };
  }, [clubs, userId]);
  const requests = useResource(`requests:${userId}:${clubs}`, load, enabled);
  const latestClubs = useRef(refreshClubs);
  useEffect(() => { latestClubs.current = refreshClubs; }, [refreshClubs]);
  useEffect(() => {
    if (!enabled || !userId) return;
    const client = requireSupabase();
    const sync = startCallUpSync({ reload: requests.reload, status: () => undefined, connect: (change, status) => {
      const channel = client.channel(`join-requests:${userId}:${Math.random().toString(36).slice(2)}`)
        // RLS limits events to the applicant and the club's active captains.
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'join_requests' }, change)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'join_requests' }, change)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'club_members', filter: `user_id=eq.${userId}` }, () => { latestClubs.current(); change(); })
        .subscribe(status);
      return () => { void client.removeChannel(channel).catch(() => undefined); };
    }});
    const appState = AppState.addEventListener('change', state => { if (state === 'active') sync.refresh(); });
    const onVisible = () => { if (document.visibilityState === 'visible') sync.refresh(); };
    if (Platform.OS === 'web') {
      window.addEventListener('online', sync.refresh); window.addEventListener('focus', sync.refresh);
      document.addEventListener('visibilitychange', onVisible);
    }
    return () => {
      sync.stop(); appState.remove();
      if (Platform.OS === 'web') {
        window.removeEventListener('online', sync.refresh); window.removeEventListener('focus', sync.refresh);
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, [enabled, userId, requests.reload]);
  return <Context.Provider value={{ incoming: requests.data?.incoming ?? [], outgoing: requests.data?.outgoing ?? [], isLoading: requests.isLoading, error: requests.error, refresh: requests.reload }}>{children}</Context.Provider>;
}

export function useRequests() {
  const value = useContext(Context);
  if (!value) throw new Error('RequestsProvider is required');
  return value;
}
