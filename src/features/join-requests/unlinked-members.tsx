import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Body, Button, Card, Message } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { t, useLanguage } from '@/features/i18n/runtime';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
import { listUnlinkedClubMembers, removeUnlinkedClubMember } from './service';

export function UnlinkedMembers({ clubId, revision }: { clubId: string; revision: number }) {
  useLanguage();
  const { session, isDemo } = useAuth();
  const { currentMembership, rosterVersion, refreshRoster } = useClub();
  const admin = currentMembership?.role === 'admin';
  const scope = `${session?.user.id}:${clubId}`;
  const load = useCallback(() => listUnlinkedClubMembers(clubId), [clubId]);
  const result = useResource(`unlinked-members:${scope}:${rosterVersion}:${revision}`, load, Boolean(session && admin && !isDemo));
  const reload = result.reload;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const [pending, setPending] = useState<{ userId: string; name: string; scope: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (!pending || pending.scope !== scope || !admin || busy) return;
    setBusy(true); setError('');
    try {
      await removeUnlinkedClubMember(clubId, pending.userId);
      setPending(null); reload(); refreshRoster();
    } catch (failure) { setError(backendErrorMessage(failure)); reload(); }
    finally { setBusy(false); }
  }
  if (!admin || isDemo) return null;
  return <>
    <Card title={t('Miembros sin ficha')}>
      <Body>{t('Cuentas del club que no tienen una ficha de jugador vinculada.')}</Body>
      {result.isLoading ? <Body>{t('Cargando…')}</Body> : null}
      {result.error ? <Message error>{result.error}</Message> : null}
      {!result.isLoading && !result.error && !result.data?.length ? <Body>{t('No hay miembros sin ficha.')}</Body> : null}
      {result.data?.map(member => <Card key={member.user_id} title={member.username}>
        <Body>{t(member.role === 'admin' ? 'Capitán' : 'Jugador')}</Body>
        {member.user_id === session?.user.id ? <Body>{t('Tu cuenta')}</Body> : <Button secondary label={t('Desvincular del club')} disabled={busy || result.isLoading} onPress={() => { setError(''); setPending({ userId: member.user_id, name: member.username, scope }); }} />}
      </Card>)}
    </Card>
    <ConfirmDialog visible={Boolean(pending?.scope === scope)} title={t('Desvincular del club')} description={t('¿Desvincular a {{v0}} del club? Perderá el acceso al club. Su cuenta y los datos históricos se conservarán.', { v0: pending?.name ?? '' })} confirmLabel={t('Desvincular del club')} busy={busy} onCancel={() => setPending(null)} onConfirm={() => void remove()}>
      {error ? <Message error>{t(error)}</Message> : null}
    </ConfirmDialog>
  </>;
}
