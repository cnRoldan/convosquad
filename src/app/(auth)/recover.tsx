import { t, useLanguage } from '@/features/i18n/runtime';
import { useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Heading, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';

export default function RecoverScreen() {
  useLanguage();
  const { signOut } = useAuth();
  const [message, setMessage] = useState('');
  return <Screen>
    <Heading title={t("Ayuda para acceder")} />
    <Body>{t("Contacta con el administrador si has olvidado tu contraseña o tu ID de EA está ocupado. La recuperación se gestiona de forma manual.")}</Body>
    {message ? <Body>{message}</Body> : null}
    <Button label={t("Volver al acceso")} onPress={() => { void signOut().then(() => router.replace('/login')).catch(() => setMessage(t("No se pudo cerrar la sesión. Inténtalo de nuevo."))); }} />
  </Screen>;
}
