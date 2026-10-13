import { useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { authCallbackUrl } from './redirect';
import { usePendingInvite } from '@/features/invitations/pending-invite-context';

import { Body, Button, Field, Heading, Screen } from '@/components/ui';
import { useAuth } from './auth-context';
import { authErrorMessage, loginAccount, registerAccount, usernamePattern } from './service';
import { isSupabaseConfigured } from '@/lib/supabase';

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const { recovered } = useLocalSearchParams<{ recovered?: string }>();
  const isRegister = mode === 'register';
  const { session, isDemo, enterDemo, exitDemo, isLoading, isRecovery } = useAuth();
  const { pendingInvite } = usePendingInvite();
  const destination = pendingInvite ? '/invite' as const : { pathname: '/clubs' as const, params: { auto: '1' } };
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (session && !isDemo) return <Redirect href={isRecovery ? '/reset-password' : destination} />;

  async function submit() {
    if (isRegister && !usernamePattern.test(username.trim())) return setMessage('Usa entre 3 y 24 letras, números o guiones bajos para tu nombre de usuario.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMessage('Introduce un correo válido.');
    if (password.length < 8) return setMessage('La contraseña debe tener al menos 8 caracteres.');
    if (!isSupabaseConfigured) return setMessage('Supabase no está configurado. Puedes explorar la demo sin crear una cuenta.');
    setBusy(true);
    setMessage('');
    try {
      exitDemo();
      if (isRegister) {
        const redirectTo = authCallbackUrl();
        const result = await registerAccount({ username, email, password, redirectTo });
        setPassword('');
        if (result.session) router.replace(destination);
        else setMessage('Revisa tu correo para confirmar la cuenta. Después podrás iniciar sesión.');
      } else {
        await loginAccount(email, password);
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
      <Heading title={isRegister ? 'Únete al vestuario' : 'Nos vemos en el campo'} subtitle={isRegister ? 'Un nombre de usuario único y un correo real para verificar y recuperar tu cuenta.' : 'Accede a todos tus clubes con tu correo y contraseña.'} />
      {isRegister ? <Field label="Nombre de usuario" value={username} onChangeText={setUsername} autoCapitalize="none" autoComplete="username" textContentType="username" editable={!busy} /> : null}
      <Field label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" editable={!busy} />
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={isRegister ? 'new-password' : 'current-password'} textContentType={isRegister ? 'newPassword' : 'password'} editable={!busy} />
      {recovered === '1' && !isRegister ? <Body>Contraseña actualizada. Inicia sesión con la nueva contraseña.</Body> : null}
      {message ? <Body>{message}</Body> : null}
      <Button disabled={busy || isLoading} label={busy ? 'Un momento…' : isRegister ? 'Crear cuenta' : 'Iniciar sesión'} onPress={() => { void submit(); }} />
      {!isRegister ? <Button secondary disabled={busy} label="He olvidado mi contraseña" onPress={() => router.push('/recover')} /> : null}
      <Button secondary disabled={busy} label="Explorar la demo" onPress={() => { setPassword(''); enterDemo(); router.replace('/clubs'); }} />
      <Button secondary disabled={busy} label={isRegister ? 'Ya tengo una cuenta' : 'Quiero registrarme'} onPress={() => router.replace(isRegister ? '/login' : '/register')} />
      <Body>{isSupabaseConfigured ? 'Acceso gestionado por Supabase Auth.' : 'Modo demo · Supabase aún no está configurado.'}</Body>
    </Screen>
  );
}
