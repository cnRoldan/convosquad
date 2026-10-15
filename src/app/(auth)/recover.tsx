import { useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Field, Heading, Message, Screen } from '@/components/ui';
import { authErrorMessage, requestRecovery, verifyRecoveryCode } from '@/features/auth/service';
import { authCallbackUrl } from '@/features/auth/redirect';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function RecoverScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function send() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMessage('Introduce un correo válido.');
    if (!isSupabaseConfigured) return setMessage('La recuperación requiere Supabase configurado. No se ha enviado ningún correo.');
    setBusy(true);
    setMessage('');
    try {
      await requestRecovery(email, authCallbackUrl());
      setSent(true);
      setMessage('Si existe una cuenta con ese correo, recibirás un enlace o código de recuperación.');
    } catch (error) { setMessage(authErrorMessage(error, 'recovery')); }
    finally { setBusy(false); }
  }
  async function verify() {
    if (!/^[0-9]{6,10}$/.test(code.trim())) return setMessage('Introduce el código de 6 a 10 dígitos de tu correo.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMessage('Introduce un correo válido.');
    setBusy(true);
    setMessage('');
    try {
      await verifyRecoveryCode(email, code);
      setCode('');
      router.replace('/reset-password');
    } catch (error) { setMessage(authErrorMessage(error, 'recovery')); }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading title="Recupera tu acceso" subtitle="Solo para cuentas anteriores con correo. Si te registraste con ID de EA, contacta con el administrador." />
    <Field label="Correo electrónico" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!busy && !sent} />
    {sent ? <>
      <Body>Abre el enlace de recuperación o introduce aquí el código del correo, incluso desde otro navegador o dispositivo.</Body>
      <Field label="Código de recuperación" value={code} onChangeText={setCode} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={10} editable={!busy} />
      <Button label={busy ? 'Comprobando…' : 'Comprobar código'} disabled={busy} onPress={() => { void verify(); }} />
      <Button secondary label="Solicitar otro correo" disabled={busy} onPress={() => { setSent(false); setCode(''); setMessage(''); }} />
    </> : <>
      <Button label={busy ? 'Solicitando…' : 'Enviar recuperación'} disabled={busy} onPress={() => { void send(); }} />
      <Button secondary label="Tengo un código de recuperación" disabled={busy} onPress={() => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMessage('Introduce el correo de tu cuenta antes de comprobar el código.');
        setSent(true); setMessage('');
      }} />
    </>}
    {message ? <Message>{message}</Message> : null}
    <Button secondary label="Volver al acceso" disabled={busy} onPress={() => router.replace('/login')} />
  </Screen>;
}
