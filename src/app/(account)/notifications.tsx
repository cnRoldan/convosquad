import { useState } from 'react';
import { Linking, Platform } from 'react-native';
import { Body, Button, Heading, Message, Screen } from '@/components/ui';
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
        setMessage(result === 'enabled' ? 'Dispositivo registrado. Los avisos automáticos se activarán en una fase posterior.' : result === 'denied' ? 'No has concedido permiso. Puedes habilitarlo en los ajustes del dispositivo.' : result === 'cancelled' ? 'La sesión ha cambiado. Vuelve a intentarlo.' : 'Usa un dispositivo físico y una compilación EAS; Expo Go no es compatible.');
      }
    } catch (error) { setMessage(error instanceof Error && error.message.startsWith('Vincula el proyecto EAS') ? error.message : 'No se pudieron configurar las notificaciones. Revisa la conexión, los permisos y la configuración EAS y FCM/APNs.'); }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading title="Notificaciones" />
    <Body>Registra este dispositivo para futuros avisos de convocatorias de tus clubes. No cambia tu disponibilidad ni activa envíos automáticos todavía.</Body>
    {Platform.OS === 'web' ? <Message>Las notificaciones push móviles se configuran desde una compilación EAS instalada en Android o iOS, no desde el navegador.</Message> : <>
      <Button label="Activar notificaciones en este dispositivo" disabled={busy || isDemo} onPress={() => { void change(true); }} />
      <Button secondary label="Desactivar en este dispositivo" disabled={busy || isDemo} onPress={() => { void change(false); }} />
      <Button secondary label="Abrir ajustes del dispositivo" disabled={busy} onPress={() => { void Linking.openSettings(); }} />
    </>}
    {message ? <Message>{message}</Message> : null}
  </Screen>;
}
