import { t, useLanguage } from '@/features/i18n/runtime';
import { useState } from 'react';
import { Linking, Platform } from 'react-native';
import { Button, Heading, Message, Screen } from '@/components/ui';
import { VoteNotificationPreference } from '@/features/notifications/vote-preference';
import { useAuth } from '@/features/auth/auth-context';
import { enableInstallation, deactivateInstallation } from '@/features/notifications/device-service';
export default function NotificationsScreen() {
  useLanguage();
  const { session, isDemo } = useAuth(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function change(enabled: boolean) {
    if (!session || isDemo || busy || Platform.OS === 'web') return;
    setBusy(true);
    try {
      if (!enabled) { await deactivateInstallation(session.user.id); setMessage(t("Notificaciones desactivadas en este dispositivo.")); }
      else {
        const result = await enableInstallation(session.user.id);
        setMessage(result === 'enabled' ? t("Notificaciones de convocatoria activadas.") : result === 'denied' ? t("No has concedido permiso. Puedes habilitarlo en los ajustes del dispositivo.") : result === 'cancelled' ? t("La sesión ha cambiado. Vuelve a intentarlo.") : t("Las notificaciones no están disponibles en este dispositivo."));
      }
    } catch { setMessage(t("No se pudieron activar las notificaciones. Comprueba tu conexión y los permisos del dispositivo.")); }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading title={t("Notificaciones")} />
    {session && !isDemo ? <VoteNotificationPreference key={session.user.id} userId={session.user.id} /> : null}
    {Platform.OS === 'web' ? <Message>{t("Las notificaciones de convocatoria están disponibles en la app para Android e iOS.")}</Message> : <>
      <Button label={t("Activar las notificaciones de convocatoria")} disabled={busy || isDemo} onPress={() => { void change(true); }} />
      <Button secondary label={t("Desactivar en este dispositivo")} disabled={busy || isDemo} onPress={() => { void change(false); }} />
      <Button secondary label={t("Abrir ajustes del dispositivo")} disabled={busy} onPress={() => { void Linking.openSettings(); }} />
    </>}
    {message ? <Message>{message}</Message> : null}
  </Screen>;
}
