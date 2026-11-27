import { t, useLanguage } from '@/features/i18n/runtime';
import { Linking as ExternalLinking, Platform } from 'react-native';
import Head from 'expo-router/head';
import { useState } from 'react';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, Heading, Message, Screen } from '@/components/ui';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { usePendingInvite } from '@/features/invitations/pending-invite-context';
import { readInvitation, invitationFragmentToken, invitationAppUrl } from '@/features/invitations/links';
import { redeemClubInvitation } from '@/features/invitations/service';
import { backendErrorMessage } from '@/lib/backend-result';

export default function InviteScreen() {
  useLanguage();
  const incomingUrl = Linking.useURL();
  const params = useLocalSearchParams<{ club?: string; token?: string }>();
  const { session, isLoading, isDemo, exitDemo } = useAuth();
  const { availableClubs, reloadClubs } = useClub();
  const { pendingInvite, isRestoring: isRestoringInvite, rememberInvite, clearInvite } = usePendingInvite();
  const incoming = readInvitation(params.club, params.token ?? invitationFragmentToken(incomingUrl));
  const invitation = params.club || params.token ? incoming : pendingInvite;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const metadata = (<Head>
      <title>{t('Invitación a ConvoSquad')}</title>
      <meta name="description" content={t('Únete a tu club desde la app o el navegador. Descarga ConvoSquad para iOS y Android.')} />
      <meta property="og:title" content={t('Invitación a ConvoSquad')} />
      <meta property="og:description" content={t('Únete a tu club desde la app o el navegador. Descarga ConvoSquad para iOS y Android.')} />
      <meta property="og:image" content="https://convosquad.com/descargar/media/compartir.png" />
      <meta name="referrer" content="no-referrer" />
    </Head>);
  if (isLoading || isRestoringInvite) return <>{metadata}<LoadingScreen label={t("Comprobando tu sesión…")} /></>;
  const ownClub = availableClubs.find((club) => club.id === invitation?.clubId);
  function authenticate(destination: '/login' | '/register') {
    if (!invitation) return;
    rememberInvite(invitation);
    exitDemo();
    router.replace(destination);
  }
  async function accept() {
    if (!invitation || isDemo || !session || busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (!ownClub) await redeemClubInvitation(invitation.clubId, invitation.token);
      await reloadClubs(invitation.clubId);
      clearInvite();
      router.replace({ pathname: '/complete-player', params: { club: invitation.clubId } });
    } catch (error) {
      setMessage(typeof error === 'object' && error !== null && 'code' in error && error.code === '22023'
        ? t("La invitación no es válida, ha caducado, está revocada o se han agotado sus usos. Solicita un enlace nuevo.")
        : backendErrorMessage(error));
    } finally { setBusy(false); }
  }
  return <Screen>
    {metadata}
    <Heading title={ownClub ? t("Ya formas parte de {{v0}}", { v0: ownClub.name }) : t("Te han invitado a un club")} />
    {!invitation ? <Message error>{t("El enlace está incompleto o no es válido. Pide una invitación nueva al administrador.")}</Message> : <>
      <Body>{session && !isDemo ? t("La incorporación utilizará tu cuenta actual.") : t("Inicia sesión o crea una cuenta antes de aceptar la invitación.")}</Body>
      {session && !isDemo ? <Button label={busy ? t("Comprobando invitación…") : ownClub ? t("Abrir mi club") : t("Aceptar invitación")} disabled={busy} onPress={() => { void accept(); }} />
        : <Button label={Platform.OS === 'web' ? t('Continuar en el navegador') : t("Iniciar sesión para continuar")} onPress={() => authenticate('/login')} />}
      {!session || isDemo ? <Button secondary label={t('Crear cuenta para unirme')} onPress={() => authenticate('/register')} /> : null}
      {Platform.OS === 'web' ? <Card title={t('¿Prefieres usar la app?')}>
        <Body>{t('Si ya tienes ConvoSquad instalada, abre esta invitación en la app.')}</Body>
        <Button label={t('Abrir invitación en la app')} onPress={() => {
          void ExternalLinking.openURL(invitationAppUrl(invitation)).catch(() => setMessage(t('Instala ConvoSquad y vuelve a abrir esta invitación para continuar.')));
        }} />
        <Button secondary label={t('Descargar en App Store')} onPress={() => {
          void ExternalLinking.openURL('https://apps.apple.com/es/app/convosquad/id6824663674').catch(() => setMessage(t('No se pudo abrir la tienda. Inténtalo de nuevo.')));
        }} />
        <Button secondary label={t('Descargar en Google Play')} onPress={() => {
          void ExternalLinking.openURL('https://play.google.com/store/apps/details?id=com.convosquad.app').catch(() => setMessage(t('No se pudo abrir la tienda. Inténtalo de nuevo.')));
        }} />
        <Body>{t('Después de instalarla, vuelve al mensaje y abre de nuevo este enlace. La invitación no se transfiere automáticamente desde la tienda.')}</Body>
      </Card> : null}
    </>}
    {message ? <Message error>{message}</Message> : null}
    <Button secondary label={t("Cancelar")} disabled={busy} onPress={() => { clearInvite(); router.replace(session && !isDemo ? '/clubs' : '/'); }} />
  </Screen>;
}
