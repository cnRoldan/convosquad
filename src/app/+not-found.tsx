import { t, useLanguage } from '@/features/i18n/runtime';
import { router } from 'expo-router';
import { Button, Heading, Screen } from '@/components/ui';

export default function NotFoundScreen() {
  useLanguage();
  return <Screen>
    <Heading title={t("Esta página no está disponible")} />
    <Button label={t("Volver al inicio")} onPress={() => router.replace('/')} />
  </Screen>;
}
