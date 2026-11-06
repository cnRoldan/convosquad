import { PlayerLinkRequests } from '@/features/invitations/player-link-requests';
import { t, useLanguage } from '@/features/i18n/runtime';
import { Body, Button, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { useRequests } from '@/features/join-requests/requests-context';
import { IncomingRequests } from '@/features/join-requests/incoming-requests';
import { UnlinkedMembers } from '@/features/join-requests/unlinked-members';
import { useState } from 'react';

export default function JoinRequestsScreen() {
  useLanguage();
  const { isDemo } = useAuth();
  const { activeClub } = useClub();
  const requests = useRequests();
  const [revision, setRevision] = useState(0);
  function refresh() { requests.refresh(); setRevision(value => value + 1); }
  return <Screen onRefresh={!isDemo ? refresh : undefined} refreshing={requests.isLoading}>
    <Heading title={t('Solicitudes pendientes')} subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    {requests.isLoading ? <Body>{t('Cargando solicitudes…')}</Body> : null}
    {requests.error ? <Message error>{requests.error}</Message> : null}
    {activeClub && !isDemo ? <><IncomingRequests clubId={activeClub.id} /><PlayerLinkRequests clubId={activeClub.id} /><UnlinkedMembers clubId={activeClub.id} revision={revision} /></> : null}
    <Button secondary label={t('Actualizar')} disabled={isDemo || requests.isLoading} onPress={refresh} />
  </Screen>;
}
