import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Body, Card, Message } from '@/components/ui';
import { IconButton } from '@/components/icon-button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { t, useLanguage } from '@/features/i18n/runtime';
import { requireSupabase } from '@/lib/supabase';
import { backendErrorMessage, unwrap } from '@/lib/backend-result';
import { useResource } from '@/hooks/use-resource';

export function RosterHelpers({ clubId, version }: { clubId: string; version: number }) {
  useLanguage();
  const { session, isDemo } = useAuth();
  const { currentMembership, refreshRoster } = useClub();
  const admin = currentMembership?.role === 'admin';
  const scope = `${session?.user.id}:${clubId}`;
  const [pending, setPending] = useState<{ id: string; name: string; scope: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => unwrap(await requireSupabase().rpc('list_roster_helpers', { p_club_id: clubId })), [clubId]);
  const result = useResource(`helpers:${session?.user.id}:${clubId}:${version}`, load, Boolean(session) && !isDemo);
  async function remove() {
    if (!pending || pending.scope !== scope || !admin || busy) return;
    setBusy(true); setError('');
    try {
      const { error } = await requireSupabase().rpc('remove_roster_helper', { p_guest_id: pending.id });
      if (error) throw error;
      setPending(null); result.reload(); refreshRoster();
    } catch (failure) { setError(backendErrorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <>
    {result.error ? <Message error>{t(result.error)}</Message> : null}
    {result.data?.length ? <Card title={t('Ayudas')}>
      {result.data.map(helper => <View key={helper.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}><Body>{helper.name}</Body></View>
        {admin ? <IconButton icon="trash" danger label={t('Quitar ayuda {{v0}} de la plantilla', { v0: helper.name })} disabled={busy} onPress={() => { setError(''); setPending({ ...helper, scope }); }} /> : null}
      </View>)}
    </Card> : null}
    <ConfirmDialog visible={Boolean(admin && pending?.scope === scope)} title={t('Quitar ayuda de la plantilla')} description={t('¿Quitar a {{v0}} de las ayudas de la plantilla? Las convocatorias y alineaciones anteriores conservarán sus datos.', { v0: pending?.name ?? '' })} confirmLabel={t('Quitar ayuda')} busy={busy} onCancel={() => setPending(null)} onConfirm={() => void remove()}>
      {error ? <Message error>{t(error)}</Message> : null}
    </ConfirmDialog>
  </>;
}
