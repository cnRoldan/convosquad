import { t, useLanguage } from '@/features/i18n/runtime';
import { useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Body, Button, Field, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { changeAccountPassword, authErrorMessage } from '@/features/auth/service';

export default function ChangePasswordScreen() {
  useLanguage();
  const { session, isDemo } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const submitting = useRef(false);
  if (isDemo || !session) return <Redirect href="/clubs" />;

  async function submit() {
    if (submitting.current || !session) return;
    submitting.current = true; setBusy(true); setMessage('');
    try {
      await changeAccountPassword(session.user.id, { currentPassword, newPassword, confirmation });
      setDone(true);
    } catch (error) { setMessage(authErrorMessage(error, 'password')); }
    finally {
      setCurrentPassword(''); setNewPassword(''); setConfirmation('');
      submitting.current = false; setBusy(false);
    }
  }
  return <Screen>
    <Heading title={t("Cambiar mi contraseña")} />
    {done ? <Message>{t("Contraseña actualizada. Utiliza la nueva contraseña la próxima vez que inicies sesión.")}</Message> : <>
      <Body>{t("Introduce tu contraseña actual y elige una nueva de al menos 8 caracteres.")}</Body>
      <Field label={t("Contraseña actual")} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoComplete="current-password" autoCapitalize="none" autoCorrect={false} editable={!busy} />
      <Field label={t("Nueva contraseña")} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" autoCapitalize="none" autoCorrect={false} editable={!busy} />
      <Field label={t("Confirmar nueva contraseña")} value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" autoCapitalize="none" autoCorrect={false} editable={!busy} />
      {message ? <Message error>{message}</Message> : null}
      <Button label={busy ? t("Guardando…") : t("Guardar contraseña")} disabled={busy || !currentPassword || !newPassword || !confirmation} onPress={() => { void submit(); }} />
    </>}
    <Button secondary label={t("Volver a mis clubes")} disabled={busy} onPress={() => router.replace('/clubs')} />
  </Screen>;
}
