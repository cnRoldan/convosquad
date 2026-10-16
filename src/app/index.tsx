import { router } from 'expo-router';
import { useAuth } from '@/features/auth/auth-context';

import { Body, Button, Card, Heading, Screen } from '@/components/ui';

export default function WelcomeScreen() {
  const { enterDemo } = useAuth();
  return (
    <Screen>
      <Heading title="Tu equipo. A una convocatoria de distancia." subtitle="Organiza tus noches de Clubes Pro y reúne a tu plantilla." />
      <Card title="Cada club, su propio vestuario">
        <Body>Muévete entre tus clubes, consulta la plantilla y prepara el próximo partido.</Body>
      </Card>
      <Button label="Iniciar sesión" onPress={() => router.push('/login')} />
      <Button secondary label="Crear una cuenta" onPress={() => router.push('/register')} />
      <Button secondary label="Explorar la demo" onPress={() => { enterDemo(); router.push('/clubs'); }} />
      <Body>Prueba la demo sin crear una cuenta. Los equipos y jugadores son de ejemplo.</Body>
    </Screen>
  );
}
