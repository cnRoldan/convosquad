import { Body, Button, Card, Heading, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { formatMatchDate } from '@/lib/format';

const statusLabels = { available: 'Disponible', unanswered: 'Sin responder', unavailable: 'No disponible', backup: 'Backup' } as const;

export default function CallUpScreen() {
  const { activeClub, upcomingCallUp, rosterLoading, rosterError, refreshRoster } = useClub();
  const { isDemo } = useAuth();
  const confirmed = upcomingCallUp?.responses.filter((response) => response.status === 'available').length ?? 0;
  return (
    <Screen>
      <Heading title="Convocatoria" subtitle={activeClub?.name ?? 'Tu club'} />
      {rosterLoading ? <Body>Cargando convocatoria…</Body> : null}
      {rosterError ? <Card title="No se pudo cargar la convocatoria"><Body>{rosterError}</Body><Button label="Reintentar" onPress={refreshRoster} /></Card> : null}
      {upcomingCallUp ? <>
        <Card title={upcomingCallUp.title}>
          <Body>{formatMatchDate(upcomingCallUp.startsAt, upcomingCallUp.timezone)} · {upcomingCallUp.timezone}</Body>
          <Body>Rival: {upcomingCallUp.opponent}</Body>
          <Body>{confirmed} de {upcomingCallUp.slots} plazas disponibles</Body>
        </Card>
        <Card title="Disponibilidad">
          {upcomingCallUp.responses.map((response) => <Body key={response.id}>{response.displayName} · {statusLabels[response.status]}</Body>)}
        </Card>
        <Body>{isDemo ? 'Convocatoria simulada. ' : ''}La gestión de convocatorias y respuestas desde esta pantalla llegará en una próxima fase.</Body>
      </> : !rosterLoading && !rosterError ? <Body>Tu club aún no tiene una convocatoria.</Body> : null}
    </Screen>
  );
}
