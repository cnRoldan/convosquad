import { t, useLanguage } from '@/features/i18n/runtime';
import { router } from 'expo-router';

import { Body, Button, Card, Heading, Screen } from '@/components/ui';

export default function WelcomeScreen() {
  useLanguage();
  return (
    <Screen>
      <Heading title={t("Tu equipo. A una convocatoria de distancia.")} subtitle={t("Organiza tus noches de Clubes Pro y reúne a tu plantilla.")} />
      <Card title={t("Cada club, su propio vestuario")}>
        <Body>{t("Muévete entre tus clubes, consulta la plantilla y prepara el próximo partido.")}</Body>
      </Card>
      <Button label={t("Iniciar sesión")} onPress={() => router.push('/login')} />
      <Button secondary label={t("Crear una cuenta")} onPress={() => router.push('/register')} />
      <Button secondary label={t("Política de privacidad")} onPress={() => router.push('/privacy')} />
    </Screen>
  );
}
