import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, DemoNotice, Field, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { searchPublicClubs } from '@/features/clubs/service';
import { listMyJoinRequests, requestToJoin } from '@/features/join-requests/service';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';

export default function SearchClubsScreen() {
  const { session, isDemo } = useAuth();
  const { availableClubs } = useClub();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    if (!session) return { clubs: [], requests: [] };
    const [clubs, requests] = await Promise.all([searchPublicClubs(searched ?? ''), listMyJoinRequests(session.user.id)]);
    return { clubs, requests };
  }, [session, searched]);
  const result = useResource(`search:${session?.user.id}:${searched}`, load, !isDemo && Boolean(session) && searched !== null);
  async function request(clubId: string) {
    if (isDemo || busyId) return;
    setBusyId(clubId);
    setMessage('');
    try { await requestToJoin(clubId); setMessage('Solicitud enviada. El administrador decidirá tu incorporación.'); result.reload(); }
    catch (error) {
      setMessage(typeof error === 'object' && error !== null && 'code' in error && error.code === '23505' ? 'Ya tienes una solicitud pendiente para ese club.' : backendErrorMessage(error));
      result.reload();
    } finally { setBusyId(null); }
  }
  return <Screen>
    <Heading title="Encuentra tu equipo" subtitle="Solo se muestran los clubes que han elegido aparecer en el buscador." />
    {isDemo ? <DemoNotice /> : null}
    <Field label="Nombre del club" value={query} onChangeText={setQuery} maxLength={80} returnKeyType="search" onSubmitEditing={() => setSearched(query.trim())} />
    <Button label="Buscar" disabled={isDemo || result.isLoading} onPress={() => { setMessage(''); setSearched(query.trim()); result.reload(); }} />
    {result.isLoading ? <Body>Buscando clubes…</Body> : null}
    {result.error ? <Message error>{result.error}</Message> : null}
    {message ? <Message>{message}</Message> : null}
    {result.data?.clubs.map((club) => {
      const belongs = availableClubs.some((own) => own.id === club.club_id);
      const pending = result.data?.requests.some((request) => request.club_id === club.club_id && request.status === 'pending');
      return <Card key={club.club_id} title={club.name}>
        {club.description ? <Body>{club.description}</Body> : null}
        <Button label={belongs ? 'Ya perteneces al club' : pending ? 'Solicitud pendiente' : busyId === club.club_id ? 'Enviando…' : 'Solicitar unirme'}
          disabled={belongs || pending || Boolean(busyId)} onPress={() => { void request(club.club_id); }} />
      </Card>;
    })}
    {searched !== null && result.data?.clubs.length === 0 && !result.isLoading ? <Body>No se han encontrado clubes públicos con ese nombre.</Body> : null}
    <Button secondary label="Ver mis solicitudes" onPress={() => router.push('/my-requests')} />
  </Screen>;
}
