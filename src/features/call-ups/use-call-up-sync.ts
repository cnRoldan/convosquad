import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { requireSupabase } from '@/lib/supabase';
import { startCallUpSync } from './realtime-sync';
import type { SyncStatus } from './realtime-sync';

export function useCallUpSync(scope: string, clubId: string | undefined, enabled: boolean, reload: () => void) {
  const latest = useRef(reload);
  useEffect(() => { latest.current = reload; }, [reload]);
  const [state, setState] = useState<{ scope: string; status: SyncStatus } | null>(null);
  useEffect(() => {
    if (!enabled || !clubId) return;
    const client = requireSupabase();
    const sync = startCallUpSync({
      reload: () => latest.current(),
      status: status => setState({ scope, status }),
      connect: (change, status) => {
        const channel = client.channel(`call-ups:${clubId}:${Math.random().toString(36).slice(2)}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_ups', filter: `club_id=eq.${clubId}` }, change)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_ups', filter: `club_id=eq.${clubId}` }, change)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_up_players', filter: `club_id=eq.${clubId}` }, change)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_up_players', filter: `club_id=eq.${clubId}` }, change)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_up_aids', filter: `club_id=eq.${clubId}` }, change)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_up_aids', filter: `club_id=eq.${clubId}` }, change)
          .subscribe(status);
        return () => { void client.removeChannel(channel).catch(() => undefined); };
      },
    });
    const appState = AppState.addEventListener('change', value => { if (value === 'active') sync.refresh(); });
    const onVisible = () => { if (document.visibilityState === 'visible') sync.refresh(); };
    if (Platform.OS === 'web') {
      window.addEventListener('online', sync.refresh);
      window.addEventListener('focus', sync.refresh);
      document.addEventListener('visibilitychange', onVisible);
    }
    return () => {
      sync.stop(); appState.remove();
      if (Platform.OS === 'web') {
        window.removeEventListener('online', sync.refresh);
        window.removeEventListener('focus', sync.refresh);
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, [scope, clubId, enabled]);
  return state?.scope === scope ? state.status : 'connecting';
}
