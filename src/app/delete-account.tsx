import { useCallback, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, Field, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { accountDeletionError } from '@/features/auth/account-deletion';
import { authErrorMessage, deleteAccount, loginAccount } from '@/features/auth/service';
import { usePendingInvite } from '@/features/invitations/pending-invite-context';
import { usePendingPush } from '@/features/notifications/pending-push-context';
import { t, useLanguage } from '@/features/i18n/runtime';
import { useResource } from '@/hooks/use-resource';
import { requireSupabase } from '@/lib/supabase';

export default function DeleteAccountScreen() {
  useLanguage();
  const { session, isDemo, isLoading, finishAccountDeletion } = useAuth();
  const { selectClub, clearClub } = useClub();
  const { clearInvite } = usePendingInvite();
  const { clearPush } = usePendingPush();
  const [eaId, setEaId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submitting = useRef(false);
  const userId = session?.user.id;
  const load = useCallback(async () => {
    const client = requireSupabase();
    const [profile, blockers] = await Promise.all([
      client.from('profiles').select('username').eq('id', userId!).single(),
      client.rpc('account_deletion_blockers'),
    ]);
    if (profile.error) throw profile.error;
    if (blockers.error) throw blockers.error;
    return { username: profile.data.username, blockers: blockers.data ?? [] };
  }, [userId]);
  const account = useResource(`delete-account:${userId}`, load, Boolean(userId && !isDemo && !done));

  async function login() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setMessage('');
    try { await loginAccount(eaId, password); }
    catch (error) { setMessage(authErrorMessage(error, 'login')); }
    finally { setPassword(''); submitting.current = false; setBusy(false); }
  }
  async function remove() {
    if (submitting.current || !userId || isDemo) return;
    submitting.current = true; setBusy(true); setMessage('');
    try {
      await deleteAccount(userId, password, confirmation);
      setDone(true); setConfirming(false);
      clearClub(); clearInvite(); clearPush();
      await finishAccountDeletion();
    } catch (error) {
      setMessage(accountDeletionError(error)); setConfirming(false); account.reload();
    } finally { setPassword(''); submitting.current = false; setBusy(false); }
  }
  if (isLoading) return <LoadingScreen />;
  return <Screen>
    <Heading title={t('Eliminar mi cuenta')} subtitle="ConvoSquad" />
    {done ? <>
      <Message>{t('Tu cuenta y sus datos vinculados se han eliminado. Se ha cerrado tu sesión.')}</Message>
      <Button label={t('Volver a la bienvenida')} onPress={() => router.replace('/')} />
    </> : <>
      <Body>{t('Puedes eliminar tu cuenta desde esta página, sin tener la app instalada.')}</Body>
      <Body>{t('Se eliminarán tu acceso, perfil, fichas vinculadas, votos, valoraciones sobre ti y preferencias de notificaciones. La eliminación es definitiva.')}</Body>
      <Body>{t('Los clubes compartidos y los datos de otros jugadores se conservarán. Si eres el único capitán, primero nombra a otro capitán o elimina el club.')}</Body>
      {isDemo ? <Body>{t('Inicia sesión con tu cuenta real para solicitar su eliminación.')}</Body> : !session ? <>
        <Field label={t('ID de EA')} value={eaId} onChangeText={setEaId} autoCapitalize="none" autoCorrect={false} editable={!busy} />
        <Field label={t('Contraseña')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!busy} />
        <Button label={t('Iniciar sesión para eliminar mi cuenta')} disabled={busy || !eaId.trim() || !password} onPress={() => { void login(); }} />
      </> : account.isLoading ? <Body>{t('Comprobando tu cuenta…')}</Body> : account.error ? <>
        <Message error>{t(account.error)}</Message><Button label={t('Reintentar')} onPress={account.reload} />
      </> : account.data ? <>
        <Body>{t('Cuenta: {{v0}}', { v0: account.data.username })}</Body>
        {account.data.blockers.length ? <Card title={t('Antes de eliminar tu cuenta')}>
          <Body>{t('Eres el único capitán de estos clubes. Nombra a otro capitán o elimina el club y vuelve aquí.')}</Body>
          {account.data.blockers.map(club => <Button key={club.club_id} secondary label={club.club_name} onPress={() => { selectClub(club.club_id); router.push('/home'); }} />)}
          <Button secondary label={t('Volver a comprobar')} onPress={account.reload} />
        </Card> : <>
          <Field label={t('Contraseña actual')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!busy} />
          <Field label={t('Escribe tu ID de EA para confirmar')} value={confirmation} onChangeText={setConfirmation} autoCapitalize="none" autoCorrect={false} editable={!busy} />
          <Button label={t('Eliminar mi cuenta')} disabled={busy || !password || confirmation.trim().toLowerCase() !== account.data.username.toLowerCase()} onPress={() => setConfirming(true)} />
        </>}
      </> : null}
      {message ? <Message error>{t(message)}</Message> : null}
      <Button secondary label={session || isDemo ? t('Volver a mis clubes') : t('Volver a la bienvenida')} disabled={busy} onPress={() => router.replace(session || isDemo ? '/clubs' : '/')} />
      <ConfirmDialog visible={confirming} busy={busy} title={t('¿Eliminar tu cuenta definitivamente?')}
        description={t('Se borrarán tu cuenta y sus datos vinculados. No podrás recuperarlos. Esta acción no elimina las cuentas de otros jugadores.')}
        confirmLabel={t('Eliminar definitivamente')} onCancel={() => setConfirming(false)} onConfirm={() => { void remove(); }} />
    </>}
    <Button secondary label={t("Política de privacidad")} onPress={() => router.push('/privacy')} />
  </Screen>;
}
