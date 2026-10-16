import { t, useLanguage } from '@/features/i18n/runtime';
import { useState } from 'react';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Heading, Message, Screen } from '@/components/ui';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { usePendingInvite } from '@/features/invitations/pending-invite-context';
import { readInvitation, invitationFragmentToken } from '@/features/invitations/links';
import { redeemClubInvitation } from '@/features/invitations/service';
import { backendErrorMessage } from '@/lib/backend-result';

export default function InviteScreen() {
  useLanguage();
  const incomingUrl = Linking.useURL();
  const params = useLocalSearchParams<{ club?: string; token?: string }>();
  const { session, isLoading, isDemo, exitDemo } = useAuth();
  const { availableClubs, reloadClubs } = useClub();
  const { pendingInvite, rememberInvite, clearInvite } = usePendingInvite();
  const incoming = readInvitation(params.club, params.token ?? invitationFragmentToken(incomingUrl));
  const invitation = params.club || params.token ? incoming : pendingInvite;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (isLoading) return <LoadingScreen label={t("Comprobando tu sesión…")} />;
  const ownClub = availableClubs.find((club) => club.id === invitation?.clubId);
  function authenticate() {
    if (!invitation) return;
    rememberInvite(invitation);
    exitDemo();
    router.replace('/login');
  }
  async function accept() {
    if (!invitation || isDemo || !session || busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (!ownClub) await redeemClubInvitation(invitation.clubId, invitation.token);
      await reloadClubs(invitation.clubId);
      clearInvite();
      router.replace('/home');
    } catch (error) {
      setMessage(typeof error === 'object' && error !== null && 'code' in error && error.code === '22023'
        ? t("La invitación no es válida, ha caducado, está revocada o se han agotado sus usos. Solicita un enlace nuevo.")
        : backendErrorMessage(error));
    } finally { setBusy(false); }
  }
  return <Screen>
    <Heading title={ownClub ? t("Ya formas parte de {{v0}}", { v0: ownClub.name }) : t("Te han invitado a un club")} />
    {!invitation ? <Message error>{t("El enlace está incompleto o no es válido. Pide una invitación nueva al administrador.")}</Message> : <>
      <Body>{session && !isDemo ? t("La incorporación utilizará tu cuenta actual.") : t("Inicia sesión o crea una cuenta antes de aceptar la invitación.")}</Body>
      {session && !isDemo ? <Button label={busy ? t("Comprobando invitación…") : ownClub ? t("Abrir mi club") : t("Aceptar invitación")} disabled={busy} onPress={() => { void accept(); }} />
        : <Button label={t("Iniciar sesión para continuar")} onPress={authenticate} />}
    </>}
    {message ? <Message error>{message}</Message> : null}
    <Button secondary label={t("Cancelar")} disabled={busy} onPress={() => { clearInvite(); router.replace(session && !isDemo ? '/clubs' : '/'); }} />
  </Screen>;
}
