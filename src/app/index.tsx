import { router } from 'expo-router';

import { Body, Button, Card, Heading, Screen } from '@/components/ui';

export default function WelcomeScreen() {
  return (
    <Screen>
      <Heading title="Tu equipo. A una convocatoria de distancia." subtitle="Organiza tus noches de Clubes Pro y reúne a tu plantilla." />
      <Card title="Cada club, su propio vestuario">
        <Body>Muévete entre tus clubes, consulta la plantilla y prepara el próximo partido.</Body>
      </Card>
      <Button label="Iniciar sesión" onPress={() => router.push('/login')} />
      <Button secondary label="Crear una cuenta" onPress={() => router.push('/register')} />
      <Button secondary label="Explorar la demo" onPress={() => router.push('/clubs')} />
      <Body>Versión inicial con datos simulados. No se crean cuentas ni se envían convocatorias.</Body>
    </Screen>
  );
}
