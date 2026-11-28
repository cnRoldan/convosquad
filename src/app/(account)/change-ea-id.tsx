import { useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import { Body, Button, Field, Heading, Message, Screen } from '@/components/ui';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { authErrorMessage, changeAccountEaId } from '@/features/auth/service';
import { eaIdPattern } from '@/features/auth/ea-account';
import { t, useLanguage } from '@/features/i18n/runtime';

export default function ChangeEaIdScreen() {
  useLanguage();
  const { session, isDemo } = useAuth();
  const { accountEaId } = useClub();
  if (!session || isDemo) return <Redirect href="/clubs" />;
  const name = accountEaId ?? session.user.user_metadata.username;
  if (typeof name !== 'string') return <LoadingScreen label={t('Cargando tu cuenta…')} />;
  return <ChangeEaIdForm key={session.user.id} userId={session.user.id} currentEaId={name} />;
}
function ChangeEaIdForm({ userId, currentEaId }: { userId: string; currentEaId: string }) {
  useLanguage();
  const { reloadClubs } = useClub();
  const [newEaId, setNewEaId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [sessionWarning, setSessionWarning] = useState(false);
  const submitting = useRef(false);
  async function submit() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setMessage('');
    try {
      const result = await changeAccountEaId(userId, { currentEaId, newEaId, currentPassword: password });
      setDone(result.eaId); setSessionWarning(!result.sessionRefreshed);
      await reloadClubs().catch(() => setSessionWarning(true));
    } catch (error) { setMessage(t(authErrorMessage(error, 'ea-id'))); }
    finally { setPassword(''); setBusy(false); submitting.current = false; }
  }
  return <Screen>
    <Heading title={t('Cambiar mi ID de EA')} />
    {done ? <>
      <Message>{t('ID actualizado a {{v0}}. A partir de ahora, inicia sesión con este ID y tu contraseña habitual.', { v0: done })}</Message>
      {sessionWarning ? <Message>{t('El ID ya se ha guardado, pero no se pudo actualizar la sesión. Si vuelves a entrar, utiliza el nuevo ID.')}</Message> : null}
    </> : <>
      <Body>{t('Puedes corregir tu usuario sin crear otra cuenta. Se conservarán tus clubes, fichas, respuestas y valoraciones.')}</Body>
      <Body>{t('Los nombres de las fichas del club y de las convocatorias anteriores se mantienen. El capitán puede vincular tu cuenta aunque los nombres no coincidan.')}</Body>
      <Field label={t('ID de EA actual')} value={currentEaId} editable={false} />
      <Field label={t('Nuevo ID de EA')} value={newEaId} onChangeText={setNewEaId} autoCapitalize="none" autoCorrect={false} maxLength={24} editable={!busy} />
      <Field label={t('Contraseña actual')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" autoCapitalize="none" autoCorrect={false} editable={!busy} />
      <Body>{t('El nuevo ID será tu usuario de acceso. Comprueba que esté bien escrito antes de guardarlo.')}</Body>
      {message ? <Message error>{message}</Message> : null}
      <Button label={busy ? t('Guardando…') : t('Guardar nuevo ID')} disabled={busy || !password || !eaIdPattern.test(newEaId.trim()) || newEaId.trim() === currentEaId} onPress={() => { void submit(); }} />
    </>}
    <Button secondary label={t('Volver a mis clubes')} disabled={busy} onPress={() => router.replace('/clubs')} />
  </Screen>;
}
