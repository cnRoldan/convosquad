import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { listMyJoinRequests } from '@/features/join-requests/service';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';

const statuses = { pending: 'Pendiente de revisión', approved: 'Aprobada', rejected: 'Rechazada' } as const;
export default function MyRequestsScreen() {
  const { session, isDemo } = useAuth();
  const { reloadClubs } = useClub();
  const [message, setMessage] = useState('');
  const load = useCallback(() => session ? listMyJoinRequests(session.user.id) : Promise.resolve([]), [session]);
  const requests = useResource(`my-requests:${session?.user.id}`, load, Boolean(session) && !isDemo);
  async function openClub(clubId: string) {
    try { await reloadClubs(clubId); router.replace('/home'); }
    catch (error) { setMessage(backendErrorMessage(error)); }
  }
  return <Screen>
    <Heading title="Mis solicitudes" subtitle="Comprueba si tu club ha aprobado tu incorporación." />
    {isDemo ? <DemoNotice /> : null}
    {requests.isLoading ? <Body>Cargando solicitudes…</Body> : null}
    {requests.error ? <Message error>{requests.error}</Message> : null}
    {message ? <Message error>{message}</Message> : null}
    {requests.data?.map((request) => <Card key={request.id} title={request.club_name_snapshot}>
      <Body>{statuses[request.status]}</Body>
      {request.status === 'approved' ? <Button label="Entrar al club" onPress={() => { void openClub(request.club_id); }} /> : null}
    </Card>)}
    {requests.data?.length === 0 ? <Body>No tienes solicitudes.</Body> : null}
    <Button secondary label="Actualizar solicitudes" disabled={isDemo || requests.isLoading} onPress={requests.reload} />
    <Button secondary label="Buscar clubes" onPress={() => router.push('/search-clubs')} />
  </Screen>;
}
