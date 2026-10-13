import { router } from 'expo-router';
import { Button, Heading, Screen } from '@/components/ui';

export default function NotFoundScreen() {
  return <Screen>
    <Heading title="Esta página no está disponible" />
    <Button label="Volver al inicio" onPress={() => router.replace('/')} />
  </Screen>;
}
