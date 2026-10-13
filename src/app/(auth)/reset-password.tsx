import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Body, Button, Field, Heading, Message, Screen } from '@/components/ui';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { authErrorMessage, changeRecoveredPassword } from '@/features/auth/service';

export default function ResetPasswordScreen() {
  const { session, isRecovery, isLoading, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const [message, setMessage] = useState('');
  if (isLoading) return <LoadingScreen label="Verificando el acceso de recuperación…" />;
  if (!session || !isRecovery) return <Redirect href="/recover" />;

  async function submit() {
    if (!changed && password.length < 8) return setMessage('Utiliza al menos 8 caracteres.');
    if (!changed && password !== confirmation) return setMessage('Las contraseñas no coinciden.');
    setBusy(true);
    let completed = changed;
    try {
      if (!changed) {
        await changeRecoveredPassword(password);
        completed = true;
        setChanged(true);
        setPassword('');
        setConfirmation('');
      }
      await signOut();
      router.replace({ pathname: '/login', params: { recovered: '1' } });
    } catch (error) {
      setMessage(completed ? 'Contraseña actualizada. Intenta cerrar la sesión para volver a acceder.' : authErrorMessage(error, 'password'));
    } finally { setBusy(false); }
  }
  return <Screen>
    <Heading title="Nueva contraseña" subtitle="Tu acceso de recuperación está verificado." />
    {!changed ? <>
      <Field label="Nueva contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" editable={!busy} />
      <Field label="Repetir contraseña" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" editable={!busy} />
    </> : <Body>La contraseña se ha actualizado. Inicia sesión de nuevo para continuar.</Body>}
    {message ? <Message error>{message}</Message> : null}
    <Button label={busy ? 'Un momento…' : changed ? 'Cerrar sesión' : 'Guardar contraseña'} disabled={busy} onPress={() => { void submit(); }} />
  </Screen>;
}
