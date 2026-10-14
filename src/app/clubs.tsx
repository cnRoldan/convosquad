import { useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, Heading, Message, Screen } from '@/components/ui';
import { LoadingScreen } from '@/components/loading';
import { AuthAccess } from '@/components/access';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { usePendingInvite } from '@/features/invitations/pending-invite-context';
import { backendErrorMessage } from '@/lib/backend-result';

export default function ClubsScreen() {
  return <AuthAccess><ClubSelection /></AuthAccess>;
}
function ClubSelection() {
  const { auto } = useLocalSearchParams<{ auto?: string }>();
  const { availableClubs, ownMemberships, activeClub, selectClub, clearClub, isLoading, error, refresh } = useClub();
  const { isDemo, signOut, exitDemo } = useAuth();
  const { pendingInvite, clearInvite } = usePendingInvite();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (isLoading) return <LoadingScreen label="Cargando tus clubes…" />;
  if (auto === '1' && availableClubs.length === 1 && activeClub) return <Redirect href="/home" />;

  async function leave() {
    setBusy(true);
    try {
      if (isDemo) exitDemo(); else await signOut();
      clearClub();
      clearInvite();
      router.replace('/');
    } catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading title="Elige tu club" subtitle={isDemo ? 'Hola, Álex. Estos son tus vestuarios en la demo.' : 'Una cuenta, varios vestuarios independientes.'} />
    {error ? <Card title="No se pudieron cargar los clubes"><Message error>{error}</Message><Button label="Reintentar" onPress={refresh} /></Card> : null}
    {pendingInvite ? <Button label="Continuar invitación" onPress={() => router.push('/invite')} /> : null}
    {availableClubs.map((club) => <Card key={club.id} title={club.name}>
      {club.description ? <Body>{club.description}</Body> : null}
      <Body>{ownMemberships.find((member) => member.clubId === club.id)?.role === 'admin' ? 'Administrador' : 'Jugador'} · {club.timezone}</Body>
      <Button label="Entrar al club" onPress={() => { selectClub(club.id); router.replace('/home'); }} />
    </Card>)}
    {!availableClubs.length && !error ? <Body>Aún no perteneces a ningún club. Crea uno, busca tu equipo o abre una invitación.</Body> : null}
    <Button label="Crear un club" onPress={() => router.push('/create-club')} />
    <Button secondary label="Buscar clubes" onPress={() => router.push('/search-clubs')} />
    <Button secondary label="Notificaciones" onPress={() => router.push('/notifications')} />
    <Button secondary label="Mis solicitudes" onPress={() => router.push('/my-requests')} />
    {!isDemo ? <Button secondary label="Actualizar mis clubes" onPress={refresh} /> : null}
    {message ? <Message error>{message}</Message> : null}
    <Button secondary disabled={busy} label={isDemo ? 'Volver a la bienvenida' : 'Cerrar sesión'} onPress={() => { void leave(); }} />
  </Screen>;
}
