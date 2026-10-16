import { useState } from 'react';
import { Linking, Platform } from 'react-native';
import { Button, Heading, Message, Screen } from '@/components/ui';
import { VoteNotificationPreference } from '@/features/notifications/vote-preference';
import { useAuth } from '@/features/auth/auth-context';
import { enableInstallation, deactivateInstallation } from '@/features/notifications/device-service';
export default function NotificationsScreen() {
  const { session, isDemo } = useAuth(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function change(enabled: boolean) {
    if (!session || isDemo || busy || Platform.OS === 'web') return;
    setBusy(true);
    try {
      if (!enabled) { await deactivateInstallation(session.user.id); setMessage('Notificaciones desactivadas en este dispositivo.'); }
      else {
        const result = await enableInstallation(session.user.id);
        setMessage(result === 'enabled' ? 'Notificaciones de convocatoria activadas.' : result === 'denied' ? 'No has concedido permiso. Puedes habilitarlo en los ajustes del dispositivo.' : result === 'cancelled' ? 'La sesión ha cambiado. Vuelve a intentarlo.' : 'Usa un dispositivo físico y una compilación EAS; Expo Go no es compatible.');
      }
    } catch { setMessage('No se pudieron activar las notificaciones. Comprueba tu conexión y los permisos del dispositivo.'); }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading title="Notificaciones" />
    {session && !isDemo ? <VoteNotificationPreference key={session.user.id} userId={session.user.id} /> : null}
    {Platform.OS === 'web' ? <Message>Las notificaciones de convocatoria están disponibles en la app para Android e iOS.</Message> : <>
      <Button label="Activar las notificaciones de convocatoria" disabled={busy || isDemo} onPress={() => { void change(true); }} />
      <Button secondary label="Desactivar en este dispositivo" disabled={busy || isDemo} onPress={() => { void change(false); }} />
      <Button secondary label="Abrir ajustes del dispositivo" disabled={busy} onPress={() => { void Linking.openSettings(); }} />
    </>}
    {message ? <Message>{message}</Message> : null}
  </Screen>;
}
