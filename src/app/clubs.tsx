import { router } from 'expo-router';

import { Body, Button, Card, Heading, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { demoUserId, memberships } from '@/features/clubs/mock-data';

export default function ClubsScreen() {
  const { availableClubs, selectClub, clearClub } = useClub();
  return (
    <Screen>
      <Heading title="Elige tu club" subtitle="Hola, Álex. Estos son tus vestuarios en la demo." />
      {availableClubs.map((club) => {
        const membership = memberships.find((member) => member.clubId === club.id && member.userId === demoUserId);
        return <Card key={club.id} title={club.name}>
          <Body>{club.description}</Body>
          <Body>{membership?.role === 'admin' ? 'Administrador' : 'Jugador'}</Body>
          <Button label="Entrar al club" onPress={() => { selectClub(club.id); router.replace('/home'); }} />
        </Card>;
      })}
      <Body>La plantilla, el rol y las convocatorias dependen del club seleccionado.</Body>
      <Button secondary label="Volver a la bienvenida" onPress={() => { clearClub(); router.replace('/'); }} />
    </Screen>
  );
}
