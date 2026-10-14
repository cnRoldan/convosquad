import { useCallback } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { listCallUpHistory } from '@/features/call-ups/service';
import { callStatusLabels } from '@/features/call-ups/availability';
import { useCallUpSync } from '@/features/call-ups/use-call-up-sync';
import { useResource } from '@/hooks/use-resource';
import { formatMatchDate } from '@/lib/format';
export default function CallUpHistoryScreen() {
  const { activeClub, currentMembership, rosterVersion } = useClub(); const { session, isDemo } = useAuth();
  const clubId = activeClub?.id; const enabled = Boolean(session && clubId && currentMembership?.role === 'admin' && !isDemo);
  const scope = `history:${session?.user.id}:${clubId}:${rosterVersion}`;
  const load = useCallback(() => clubId ? listCallUpHistory(clubId) : Promise.resolve([]), [clubId]);
  const result = useResource(scope, load, enabled);
  useCallUpSync(scope, clubId, enabled, result.reload);
  return <Screen>
    <Heading title="Historial de convocatorias" subtitle={activeClub?.name ?? ''} />
    <Body>Las diez convocatorias de días anteriores más recientes, según la zona horaria del club. Solo administradores.</Body>
    {isDemo ? <DemoNotice /> : null}
    {result.isLoading ? <Body>Cargando historial…</Body> : null}
    {result.error ? <Message error>{result.error}</Message> : null}
    {result.data?.map(call => <Card key={call.id} title={formatMatchDate(call.starts_at, call.timezone)}>
      <Body>{callStatusLabels[call.status]}</Body>
      <Button secondary label={`Consultar convocatoria del ${call.local_date}`} onPress={() => router.push({ pathname: '/call-up', params: { id: call.id } })} />
    </Card>)}
    {result.data?.length === 0 ? <Body>No hay convocatorias de días anteriores.</Body> : null}
    {!isDemo ? <Button secondary label="Actualizar historial" disabled={result.isLoading} onPress={result.reload} /> : <Body>El historial real requiere una cuenta administradora.</Body>}
  </Screen>;
}
