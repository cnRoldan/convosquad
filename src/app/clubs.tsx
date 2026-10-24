import { AppVersion } from '@/components/app-version';
import { t, useLanguage } from '@/features/i18n/runtime';
import { Text, View } from 'react-native';
import { ClubCrest } from '@/features/clubs/club-crest';
import { colors } from '@/theme';
import { useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, Heading, Message, Screen } from '@/components/ui';
import { LoadingScreen } from '@/components/loading';
import { AuthAccess } from '@/components/access';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { usePendingInvite } from '@/features/invitations/pending-invite-context';
import { logoutErrorMessage } from '@/features/auth/logout';
import { useSessionLogout } from '@/features/auth/use-session-logout';
import { useRequests } from '@/features/join-requests/requests-context';

export default function ClubsScreen() {
  useLanguage();
  return <AuthAccess><ClubSelection /></AuthAccess>;
}
function ClubSelection() {
  useLanguage();
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const { availableClubs, ownMemberships, activeClub, selectClub, isLoading, error, refresh } = useClub();
  const { isDemo } = useAuth();
  const { pendingInvite } = usePendingInvite();
  const { logout, isSigningOut } = useSessionLogout();
  const [message, setMessage] = useState('');
  const requests = useRequests();
  const pendingCount = requests.error ? 0 : requests.incoming.length;
  if (isLoading) return <LoadingScreen label={t("Cargando tus clubes…")} />;
  if (auto === '1' && availableClubs.length === 1 && activeClub) return <Redirect href="/home" />;

  async function leave() {
    setMessage('');
    try { await logout(); }
    catch (error) { setMessage(t(logoutErrorMessage(error))); }
  }
  return <Screen>
    <Heading title={t("Elige tu club")} subtitle={isDemo ? t("Hola, Álex. Estos son tus vestuarios en la demo.") : t("Una cuenta, varios vestuarios independientes.")} />
    {error ? <Card title={t("No se pudieron cargar los clubes")}><Message error>{error}</Message><Button label={t("Reintentar")} onPress={refresh} /></Card> : null}
    {pendingInvite ? <Button label={t("Continuar invitación")} onPress={() => router.push('/invite')} /> : null}
    {availableClubs.map((club) => <Card key={club.id}>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}><Text style={{flex: 1, color: colors.text, fontSize: 20, fontWeight: '700'}}>{club.name}</Text><ClubCrest path={club.crestPath} name={club.name} /></View>
      {club.description ? <Body>{club.description}</Body> : null}
      <Body>{ownMemberships.find((member) => member.clubId === club.id)?.role === 'admin' ? t("Capitán") : t("Jugador")} · {club.timezone}</Body>
      <Button label={t("Entrar al club")} onPress={() => { selectClub(club.id); router.replace('/home'); }} />
    </Card>)}
    {!availableClubs.length && !error ? <Body>{t("Aún no perteneces a ningún club. Crea uno, busca tu equipo o abre una invitación.")}</Body> : null}
    <Button label={t("Crear un club")} onPress={() => router.push('/create-club')} />
    <Button secondary label={t("Buscar clubes")} onPress={() => router.push('/search-clubs')} />
    <Button secondary label={t("Notificaciones")} onPress={() => router.push('/notifications')} />
    {!isDemo ? <Button secondary label={t("Cambiar mi contraseña")} onPress={() => router.push('/change-password')} /> : null}
    <Button secondary label={t("Mis solicitudes")} badge={pendingCount} accessibilityLabel={pendingCount ? t('Mis solicitudes, {{v0}} pendientes de revisión', { v0: pendingCount }) : t('Mis solicitudes')} onPress={() => router.push('/my-requests')} />
    {requests.error ? <Message error>{t('No se pudieron actualizar las solicitudes.')}</Message> : null}
    {!isDemo ? <Button secondary label={t("Actualizar mis clubes")} onPress={() => { refresh(); requests.refresh(); }} /> : null}
    {message ? <Message error>{message}</Message> : null}
    {!isDemo ? <Button secondary label={t("Eliminar mi cuenta")} onPress={() => router.push('/delete-account')} /> : null}
    <Button secondary label={t("Política de privacidad")} onPress={() => router.push('/privacy')} />
    <Button secondary disabled={isSigningOut} label={isDemo ? t("Volver a la bienvenida") : t("Cerrar sesión")} onPress={() => { void leave(); }} />
    <AppVersion />
  </Screen>;
}
