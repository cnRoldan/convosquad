import { useCallback, useState } from 'react';
import { Body, Button, Card, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { listJoinRequests, reviewJoinRequest } from '@/features/join-requests/service';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';

export default function JoinRequestsScreen() {
  const { session, isDemo } = useAuth();
  const { activeClub, refreshRoster } = useClub();
  const clubId = activeClub?.id;
  const load = useCallback(() => clubId ? listJoinRequests(clubId) : Promise.resolve([]), [clubId]);
  const requests = useResource(`join-requests:${session?.user.id}:${clubId}`, load, Boolean(clubId && session) && !isDemo);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  async function review(id: string, approve: boolean) {
    if (isDemo || busy) return;
    setBusy(id);
    setMessage('');
    try {
      await reviewJoinRequest(id, approve);
      setMessage(approve ? 'Solicitud aprobada. El usuario ya puede acceder al club.' : 'Solicitud rechazada.');
      requests.reload();
      refreshRoster();
    } catch (error) { setMessage(backendErrorMessage(error)); requests.reload(); }
    finally { setBusy(null); }
  }
  return <Screen>
    <Heading title="Solicitudes pendientes" subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    {requests.isLoading ? <Body>Cargando solicitudes…</Body> : null}
    {requests.error ? <Message error>{requests.error}</Message> : null}
    {message ? <Message>{message}</Message> : null}
    {requests.data?.map((request) => <Card key={request.id} title={request.profiles?.username ?? 'Usuario solicitante'}>
      <Body>Quiere incorporarse como jugador.</Body>
      <Button label="Aprobar" disabled={Boolean(busy)} onPress={() => { void review(request.id, true); }} />
      <Button secondary label="Rechazar" disabled={Boolean(busy)} onPress={() => { void review(request.id, false); }} />
    </Card>)}
    {requests.data?.length === 0 ? <Body>No hay solicitudes pendientes.</Body> : null}
    <Button secondary label="Actualizar" disabled={isDemo || requests.isLoading} onPress={requests.reload} />
  </Screen>;
}
