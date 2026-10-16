import { useCallback, useEffect, useState } from 'react';
import { Platform, Share } from 'react-native';
import * as Linking from 'expo-linking';
import { Body, Button, Card, DemoNotice, Field, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { createClubInvitation, listClubInvitations, revokeClubInvitation } from '@/features/invitations/service';
import { invitationUrl, webInviteBase } from '@/features/invitations/links';
import { useResource } from '@/hooks/use-resource';
import { formatMatchDate } from '@/lib/format';
import { backendErrorMessage } from '@/lib/backend-result';

export default function InvitationsScreen() {
  const { session, isDemo } = useAuth();
  const { activeClub } = useClub();
  const clubId = activeClub?.id;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const [hours, setHours] = useState('24');
  const [uses, setUses] = useState('1');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const load = useCallback(() => clubId ? listClubInvitations(clubId) : Promise.resolve([]), [clubId]);
  const invitations = useResource(`invitations:${session?.user.id}:${clubId}`, load, Boolean(session && clubId) && !isDemo);
  async function create() {
    if (!clubId || isDemo || busy) return;
    if (!/^[0-9]+$/.test(hours) || Number(hours) < 1 || Number(hours) > 720) return setMessage('La caducidad debe estar entre 1 y 720 horas.');
    if (!/^[0-9]+$/.test(uses) || Number(uses) < 1 || Number(uses) > 100) return setMessage('Permite entre 1 y 100 incorporaciones.');
    setBusy(true);
    setMessage('');
    try {
      const origin = process.env.EXPO_PUBLIC_INVITE_BASE_URL;
      const local = Linking.createURL('/invite');
      if (!origin && Platform.OS === 'web' && new URL(local).protocol !== 'https:') {
        setMessage('Configura una dirección web HTTPS accesible para compartir invitaciones desde esta versión web.');
        return;
      }
      const base = origin ? webInviteBase(origin) : local;
      const invitation = await createClubInvitation(clubId, Number(hours), Number(uses));
      setLink({ id: invitation.id, url: invitationUrl(base, { clubId, token: invitation.token }) });
      setMessage('Invitación creada. Comparte este enlace; no podrás recuperarlo al salir de esta pantalla.');
      invitations.reload();
    } catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    if (isDemo || busy) return;
    setBusy(true);
    try { await revokeClubInvitation(id); if (link?.id === id) setLink(null); setMessage('Invitación revocada.'); invitations.reload(); }
    catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); }
  }
  async function share() {
    if (!link) return;
    try { await Share.share({ message: `Únete a ${activeClub?.name ?? 'mi club'} en ConvoSquad: ${link.url}` }); }
    catch { setMessage('No se pudo abrir el menú para compartir. Prueba «Abrir WhatsApp».'); }
  }
  return <Screen>
    <Heading title="Invita a tu equipo" subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    <Field label="Caducidad en horas" value={hours} onChangeText={setHours} keyboardType="number-pad" editable={!busy} />
    <Field label="Número máximo de incorporaciones" value={uses} onChangeText={setUses} keyboardType="number-pad" editable={!busy} />
    <Button label={busy ? 'Un momento…' : 'Generar invitación'} disabled={isDemo || busy} onPress={() => { void create(); }} />
    {message ? <Message>{message}</Message> : null}
    {link ? <Card title="Comparte tu invitación">
      <Body>El enlace permite incorporarse sin aprobación adicional. Compártelo solo con los jugadores que quieres invitar.</Body>
      {!process.env.EXPO_PUBLIC_INVITE_BASE_URL ? <Body>Este enlace se abre con ConvoSquad instalada en el móvil.</Body> : null}
      <Button label="Compartir enlace" onPress={() => { void share(); }} />
      <Button secondary label="Abrir WhatsApp" onPress={() => {
        void Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`Únete a ${activeClub?.name ?? 'mi club'}: ${link.url}`)}`)
          .catch(() => setMessage('No se pudo abrir WhatsApp en este dispositivo.'));
      }} />
    </Card> : null}
    {invitations.isLoading ? <Body>Cargando invitaciones…</Body> : null}
    {invitations.error ? <Message error>{invitations.error}</Message> : null}
    {invitations.data?.map((invitation) => {
      const expired = new Date(invitation.expires_at).getTime() <= now;
      const status = invitation.revoked_at ? 'Revocada' : expired ? 'Caducada' : invitation.uses >= invitation.max_uses ? 'Agotada' : 'Activa';
      return <Card key={invitation.id} title={status}>
        <Body>{invitation.uses} de {invitation.max_uses} incorporaciones · caduca {formatMatchDate(invitation.expires_at, activeClub?.timezone)}</Body>
        {!invitation.revoked_at ? <Button secondary label="Revocar invitación" disabled={busy} onPress={() => { void revoke(invitation.id); }} /> : null}
      </Card>;
    })}
    {invitations.data?.length === 0 ? <Body>Aún no hay invitaciones.</Body> : null}
  </Screen>;
}
