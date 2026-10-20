import { useState } from 'react';
import { Body, Button, Card, Message } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { t } from '@/features/i18n/runtime';
import { backendErrorMessage } from '@/lib/backend-result';
import { useRequests } from './requests-context';
import { reviewJoinRequest } from './service';

export function IncomingRequests({ clubId }: { clubId?: string }) {
  const requests = useRequests();
  const { availableClubs, refreshRoster } = useClub();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const incoming = requests.incoming.filter(request => !clubId || request.club_id === clubId);
  async function review(id: string, approve: boolean) {
    if (busy) return;
    setBusy(id); setMessage(null);
    try {
      await reviewJoinRequest(id, approve);
      setMessage({ text: approve ? t('Solicitud aprobada. El usuario ya puede acceder al club.') : t('Solicitud rechazada.'), error: false });
      requests.refresh(); refreshRoster();
    } catch (error) { setMessage({ text: backendErrorMessage(error), error: true }); requests.refresh(); }
    finally { setBusy(null); }
  }
  return <>
    {message ? <Message error={message.error}>{message.text}</Message> : null}
    {incoming.map(request => <Card key={request.id} title={request.profiles?.username ?? t('Usuario solicitante')}>
      {!clubId ? <Body>{availableClubs.find(club => club.id === request.club_id)?.name ?? request.club_name_snapshot}</Body> : null}
      <Body>{t('Quiere incorporarse como jugador.')}</Body>
      <Button label={t('Aprobar')} disabled={Boolean(busy) || requests.isLoading} onPress={() => { void review(request.id, true); }} />
      <Button secondary label={t('Rechazar')} disabled={Boolean(busy) || requests.isLoading} onPress={() => { void review(request.id, false); }} />
    </Card>)}
    {!requests.isLoading && !requests.error && !incoming.length ? <Body>{t('No hay solicitudes pendientes.')}</Body> : null}
  </>;
}
