import { router } from 'expo-router';

import { Body, Button, Card, Heading, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { formatMatchDate } from '@/lib/format';

export default function HomeScreen() {
  const { isDemo } = useAuth();
  const { activeClub, currentMembership, roster, upcomingCallUp } = useClub();
  return (
    <Screen>
      <Heading title={activeClub?.name ?? 'Tu club'} subtitle={`Tu rol: ${currentMembership?.role === 'admin' ? 'administrador' : 'jugador'}.`} />
      <Card title="El vestuario">
        <Body>{roster.length} jugadores en plantilla</Body>
        <Button secondary label="Ver plantilla" onPress={() => router.navigate('/roster')} />
      </Card>
      <Card title="Próxima convocatoria">
        {upcomingCallUp ? <>
          <Body>{upcomingCallUp.title}</Body>
          <Body>{formatMatchDate(upcomingCallUp.startsAt, upcomingCallUp.timezone)} · {upcomingCallUp.timezone}</Body>
          <Button label="Ver convocatoria" onPress={() => router.navigate('/call-up')} />
        </> : <Body>Todavía no hay convocatorias.</Body>}
      </Card>
      <Button secondary label="Cambiar de club" onPress={() => router.replace('/clubs')} />
      <Body>{isDemo ? 'Datos de demostración · sin conexión al backend.' : 'Datos del club · Supabase'}</Body>
    </Screen>
  );
}
