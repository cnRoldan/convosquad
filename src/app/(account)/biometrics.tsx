import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Body, Button, Card, Heading, Message, Screen } from '@/components/ui';
import { useBiometrics } from '@/features/auth/biometric-provider';
import { useAuth } from '@/features/auth/auth-context';

export default function BiometricsScreen() {
  const { state, lock } = useBiometrics();
  const { isDemo } = useAuth();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [label, setLabel] = useState('Biometría');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    if (Platform.OS === 'web') return;
    void Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(), LocalAuthentication.supportedAuthenticationTypesAsync()]).then(([hardware, enrolled, types]) => {
      if (!live) return;
      setAvailable(hardware && enrolled);
      setLabel(Platform.OS === 'ios' ? types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? 'Face ID' : 'Touch ID' : 'Biometría del dispositivo');
    }).catch(() => { if (live) setAvailable(false); });
    return () => { live = false; };
  }, []);
  async function change() {
    const success = await lock.setEnabled(!state.enabled);
    setMessage(success ? state.enabled ? 'Acceso biométrico desactivado en este dispositivo.' : 'Acceso biométrico activado en este dispositivo.' : 'No se ha cambiado la configuración. Puedes volver a intentarlo.');
  }
  return <Screen>
    <Heading title="Acceso biométrico" />
    {Platform.OS === 'web' ? <Body>Esta función está disponible en la app para iOS y Android.</Body> : <Card title={label}>
      <Body>Protege tu sesión al abrir la app y cuando vuelvas después de 30 segundos fuera de ella. La primera vez debes iniciar sesión con tu ID de EA y contraseña.</Body>
      <Body>El sistema puede ofrecerte el código de desbloqueo del dispositivo como alternativa.</Body>
      <Body>{state.enabled ? 'Activado en este dispositivo.' : 'Desactivado en este dispositivo.'}</Body>
      {available === false ? <Message>Configura Face ID, huella u otra biometría segura en los ajustes de tu dispositivo.</Message> : null}
      <Button label={state.busy ? 'Comprobando…' : state.enabled ? 'Desactivar acceso biométrico' : 'Activar acceso biométrico'} disabled={state.busy || isDemo || !state.ready || (!state.enabled && !available)} onPress={() => void change()} />
    </Card>}
    {message ? <Message>{message}</Message> : null}
    {state.error ? <Message error>{state.error}</Message> : null}
  </Screen>;
}
