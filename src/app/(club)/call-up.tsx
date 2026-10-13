import { Body, Card, Heading, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { formatMatchDate } from '@/lib/format';

const statusLabels = { confirmed: 'Confirmado', pending: 'Pendiente', declined: 'No disponible' } as const;

export default function CallUpScreen() {
  const { activeClub, upcomingCallUp, roster } = useClub();
  const confirmed = upcomingCallUp?.responses.filter((response) => response.status === 'confirmed').length ?? 0;
  return (
    <Screen>
      <Heading title="Convocatoria" subtitle={activeClub?.name ?? 'Tu club'} />
      {upcomingCallUp ? <>
        <Card title={upcomingCallUp.title}>
          <Body>{formatMatchDate(upcomingCallUp.startsAt)} · hora de Madrid</Body>
          <Body>Rival: {upcomingCallUp.opponent}</Body>
          <Body>{confirmed} de {upcomingCallUp.slots} plazas confirmadas</Body>
        </Card>
        <Card title="Disponibilidad">
          {upcomingCallUp.responses.map((response) => {
            const member = roster.find((player) => player.id === response.membershipId);
            return <Body key={response.membershipId}>{member?.displayName ?? 'Jugador'} · {statusLabels[response.status]}</Body>;
          })}
        </Card>
        <Body>Convocatoria simulada. Crear convocatorias y confirmar asistencia estarán disponibles en una próxima fase.</Body>
      </> : <Body>Tu club aún no tiene una convocatoria.</Body>}
    </Screen>
  );
}
