import { router } from 'expo-router';

import { Body, Button, Card, Heading, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { formatMatchDate } from '@/lib/format';

export default function HomeScreen() {
  const { isDemo } = useAuth();
  const { activeClub, currentMembership, roster, upcomingCallUp, rosterLoading, rosterError, refreshRoster, notice } = useClub();
  return (
    <Screen>
      <Heading title={activeClub?.name ?? 'Tu club'} subtitle={`Tu rol: ${currentMembership?.role === 'admin' ? 'capitán' : 'jugador'}.`} />
      {notice ? <Body>{notice}</Body> : null}
      {rosterLoading ? <Body>Cargando datos del vestuario…</Body> : null}
      {rosterError ? <Card title="No se pudieron cargar los datos"><Body>{rosterError}</Body><Button label="Reintentar" onPress={refreshRoster} /></Card> : null}
      <Card title="El vestuario">
        {!rosterLoading && !rosterError ? <Body>{roster.length} jugadores en plantilla</Body> : null}
        <Button secondary label="Ver plantilla" onPress={() => router.navigate('/roster')} />
      </Card>
      <Card title="Próxima convocatoria">
        {upcomingCallUp ? <>
          <Body>{upcomingCallUp.title}</Body>
          <Body>{formatMatchDate(upcomingCallUp.startsAt, upcomingCallUp.timezone)} · {upcomingCallUp.timezone}</Body>
          <Button label="Ver convocatoria" onPress={() => router.navigate('/call-up')} />
        </> : !rosterLoading && !rosterError ? <Body>Todavía no hay convocatorias.</Body> : null}
      </Card>
      {currentMembership?.role === 'admin' ? <Card title="Administrar el club">
        <Button secondary label="Capitanes" onPress={() => router.push('/club-settings')} />
        <Button secondary label="Historial de convocatorias" onPress={() => router.push('/call-up-history')} />
        <Button secondary label="Crear convocatoria" onPress={() => router.push('/create-call-up')} />
        <Button secondary label="Solicitudes pendientes" onPress={() => router.push('/join-requests')} />
        <Button secondary label="Invitar jugadores" onPress={() => router.push('/invitations')} />
      </Card> : null}
      <Button secondary label="Cambiar de club" onPress={() => router.replace('/clubs')} />
      {isDemo ? <Body>Estás explorando un club de ejemplo.</Body> : null}
    </Screen>
  );
}
