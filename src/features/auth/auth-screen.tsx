import { useState } from 'react';
import { router } from 'expo-router';

import { Body, Button, Field, Heading, Screen } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase';

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  function submit() {
    if (isRegister && !name.trim()) return setMessage('Introduce tu nombre.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMessage('Introduce un correo válido.');
    if (password.length < 8) return setMessage('La contraseña debe tener al menos 8 caracteres.');
    setMessage('La autenticación se conectará en la siguiente fase. Puedes explorar la demo sin crear una cuenta.');
  }

  return (
    <Screen>
      <Heading title={isRegister ? 'Únete al vestuario' : 'Nos vemos en el campo'} subtitle={isRegister ? 'Tu cuenta podrá formar parte de varios clubes.' : 'Accede a todos tus clubes desde una cuenta.'} />
      {isRegister ? <Field label="Nombre" value={name} onChangeText={setName} autoComplete="name" textContentType="name" /> : null}
      <Field label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
      <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete={isRegister ? 'new-password' : 'current-password'} textContentType={isRegister ? 'newPassword' : 'password'} />
      {message ? <Body>{message}</Body> : null}
      <Button label={isRegister ? 'Crear cuenta' : 'Iniciar sesión'} onPress={submit} />
      <Button secondary label="Explorar la demo" onPress={() => { setPassword(''); router.replace('/clubs'); }} />
      <Button secondary label={isRegister ? 'Ya tengo una cuenta' : 'Quiero registrarme'} onPress={() => router.replace(isRegister ? '/login' : '/register')} />
      <Body>{isSupabaseConfigured ? 'Configuración de Supabase detectada. Autenticación pendiente de implementación.' : 'Modo demo · Supabase aún no está configurado.'}</Body>
    </Screen>
  );
}
