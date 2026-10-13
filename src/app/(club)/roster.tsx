import { Body, Card, Heading, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';

export default function RosterScreen() {
  const { activeClub, roster } = useClub();
  return (
    <Screen>
      <Heading title="La plantilla" subtitle={activeClub?.name ?? 'Tu club'} />
      {roster.map((member) => <Card key={member.id} title={member.displayName}>
        <Body>{member.position} · {member.role === 'admin' ? 'Administrador' : 'Jugador'}</Body>
      </Card>)}
      {roster.length === 0 ? <Body>Este club todavía no tiene jugadores.</Body> : null}
    </Screen>
  );
}
