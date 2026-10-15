import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { usePendingPush } from '@/features/notifications/pending-push-context';
import { usePendingInvite } from '@/features/invitations/pending-invite-context';

import { Body, Button, Field, Heading, Screen } from '@/components/ui';
import { useAuth } from './auth-context';
import { authErrorMessage, loginAccount, registerAccount } from './service';
import { eaIdPattern } from './ea-account';
import { isSupabaseConfigured } from '@/lib/supabase';

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const { session, isDemo, enterDemo, exitDemo, isLoading, isRecovery } = useAuth();
  const { pendingInvite } = usePendingInvite(); const { pendingPush } = usePendingPush();
  const destination = pendingPush ? '/notification' as const : pendingInvite ? '/invite' as const : { pathname: '/clubs' as const, params: { auto: '1' } };
  const [eaId, setEaId] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (!isLoading && session && !isDemo) return <Redirect href={isRecovery ? '/reset-password' : destination} />;

  async function submit() {
    if (!eaIdPattern.test(eaId.trim())) return setMessage('El ID de EA debe tener entre 3 y 24 letras, números, guiones o guiones bajos.');
    if (isRegister && password.length < 8) return setMessage('La contraseña debe tener al menos 8 caracteres.');
    if (!password) return setMessage('Introduce tu contraseña.');
    if (!isSupabaseConfigured) return setMessage('Supabase no está configurado. Puedes explorar la demo sin crear una cuenta.');
    setBusy(true);
    setMessage('');
    try {
      exitDemo();
      if (isRegister) {
        await registerAccount({ eaId, password });
        setPassword('');
        router.replace(destination);
      } else {
        await loginAccount(eaId, password);
        setPassword('');
        router.replace(destination);
      }
    } catch (error) {
      setMessage(authErrorMessage(error, isRegister ? 'register' : 'login'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Heading title={isRegister ? 'Únete al vestuario' : 'Nos vemos en el campo'} subtitle={isRegister ? 'Tu ID de EA y una contraseña. Sin correo ni confirmaciones.' : 'Accede a tus clubes con tu ID de EA y contraseña.'} />
      <Field label="ID de EA" value={eaId} onChangeText={setEaId} autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" maxLength={24} editable={!busy} />
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={isRegister ? 'new-password' : 'current-password'} textContentType={isRegister ? 'newPassword' : 'password'} editable={!busy} />
      {message ? <Body>{message}</Body> : null}
      <Button disabled={busy || isLoading} label={busy ? 'Un momento…' : isRegister ? 'Crear cuenta' : 'Iniciar sesión'} onPress={() => { void submit(); }} />
      <Body>Si olvidas la contraseña o tu ID ya está ocupado, contacta con el administrador. No hay recuperación automática.</Body>
      <Button secondary disabled={busy} label="Explorar la demo" onPress={() => { setPassword(''); enterDemo(); router.replace('/clubs'); }} />
      <Button secondary disabled={busy} label={isRegister ? 'Ya tengo una cuenta' : 'Quiero registrarme'} onPress={() => router.replace(isRegister ? '/login' : '/register')} />
      <Body>{isSupabaseConfigured ? 'Acceso gestionado por Supabase Auth.' : 'Acceso real pendiente de configuración. La demo es independiente.'}</Body>
    </Screen>
  );
}
