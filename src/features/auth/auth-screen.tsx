import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { Body, Button, Field, Heading, Screen } from '@/components/ui';
import { useAuth } from './auth-context';
import { loginAccount, registerAccount, usernamePattern } from './service';
import { isSupabaseConfigured } from '@/lib/supabase';

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const { session, isDemo, enterDemo, exitDemo, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (session && !isDemo) return <Redirect href="/clubs" />;

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
        const redirectTo = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL
          || (Platform.OS === 'web' ? Linking.createURL('/auth/callback') : 'convosquad://auth/callback');
        const result = await registerAccount({ username, email, password, redirectTo });
        setPassword('');
        if (result.session) router.replace('/clubs');
        else setMessage('Revisa tu correo para confirmar la cuenta. Después podrás iniciar sesión.');
      } else {
        await loginAccount(email, password);
        setPassword('');
        router.replace('/clubs');
      }
    } catch {
      setMessage(isRegister
        ? 'No se pudo crear la cuenta. Comprueba los datos y el nombre de usuario, que debe ser único.'
        : 'No se pudo iniciar sesión. Comprueba el correo, la contraseña y que tu cuenta esté confirmada.');
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
      {message ? <Body>{message}</Body> : null}
      <Button disabled={busy || isLoading} label={busy ? 'Un momento…' : isRegister ? 'Crear cuenta' : 'Iniciar sesión'} onPress={() => { void submit(); }} />
      <Button secondary disabled={busy} label="Explorar la demo" onPress={() => { setPassword(''); enterDemo(); router.replace('/clubs'); }} />
      <Button secondary disabled={busy} label={isRegister ? 'Ya tengo una cuenta' : 'Quiero registrarme'} onPress={() => router.replace(isRegister ? '/login' : '/register')} />
      <Body>{isSupabaseConfigured ? 'Acceso gestionado por Supabase Auth.' : 'Modo demo · Supabase aún no está configurado.'}</Body>
    </Screen>
  );
}
