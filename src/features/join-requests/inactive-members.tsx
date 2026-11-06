import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Body, Card, Message } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { t, useLanguage } from '@/features/i18n/runtime';
import { useResource } from '@/hooks/use-resource';
import { formatMatchDate } from '@/lib/format';
import { listInactiveClubMembers } from './service';

export function InactiveMembers({ clubId, revision }: { clubId: string; revision: number }) {
  useLanguage();
  const { session, isDemo } = useAuth();
  const { activeClub, currentMembership, rosterVersion } = useClub();
  const admin = currentMembership?.role === 'admin';
  const load = useCallback(() => listInactiveClubMembers(clubId), [clubId]);
  const result = useResource(`inactive-members:${session?.user.id}:${clubId}:${rosterVersion}:${revision}`, load, Boolean(session && admin && !isDemo));
  const reload = result.reload;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  if (!admin || isDemo) return null;
  return <Card title={t('Miembros inactivos')}>
    <Body>{t('Miembros que llevan al menos 6 meses sin utilizar la app. Sus cuentas y fichas se conservan.')}</Body>
    {result.isLoading ? <Body>{t('Cargando…')}</Body> : null}
    {result.error ? <Message error>{result.error}</Message> : null}
    {!result.isLoading && !result.error && !result.data?.length ? <Body>{t('No hay miembros inactivos.')}</Body> : null}
    {result.data?.map(member => <Card key={member.user_id} title={member.username}>
      <Body>{t(member.role === 'admin' ? 'Capitán' : 'Jugador')}</Body>
      <Body>{t('Sin actividad desde: {{v0}}', { v0: formatMatchDate(member.last_active_at, activeClub?.timezone) })}</Body>
      {!member.has_player_card ? <Body>{t('Sin ficha de jugador vinculada.')}</Body> : null}
      {member.sole_captain ? <Body>{t('Único capitán del club. Debe conservarse el acceso a la administración.')}</Body> : null}
    </Card>)}
  </Card>;
}
