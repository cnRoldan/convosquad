import { CrestSettings } from '@/features/clubs/crest-settings';
import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { deleteClub, getClubSettings, listClubAccounts, setClubMember } from '@/features/clubs/service';
import { listPlayers } from '@/features/players/service';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';

export default function ClubSettingsScreen() {
  const { session } = useAuth();
  const { activeClub } = useClub();
  return <ClubSettingsContent key={`${session?.user.id}:${activeClub?.id}`} />;
}

function ClubSettingsContent() {
  const { session, isDemo } = useAuth();
  const { activeClub, currentMembership, reloadClubs } = useClub();
  const clubId = activeClub?.id;
  const load = useCallback(async () => {
    const [club, accounts, players] = await Promise.all([getClubSettings(clubId!), listClubAccounts(clubId!), listPlayers(clubId!)]);
    return { club, accounts, players };
  }, [clubId]);
  const result = useResource(`club-settings:${session?.user.id}:${clubId}`, load, Boolean(session && clubId) && !isDemo);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ userId: string; name: string; role: 'admin' | 'player' } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const admin = currentMembership?.role === 'admin';
  const data = result.data;
  const owner = data?.club.created_by === session?.user.id;
  async function changeCaptain() {
    if (!clubId || !pending || !admin || isDemo || busy) return;
    setBusy(true); setMessage('');
    try {
      await setClubMember(clubId, pending.userId, pending.role, true);
      setMessage(pending.role === 'admin' ? 'Capitán designado.' : 'El jugador ya no es capitán.');
      result.reload(); await reloadClubs();
    } catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); setPending(null); }
  }
  async function removeClub() {
    if (!clubId || !owner || !admin || isDemo || busy) return;
    setBusy(true); setMessage('');
    try { await deleteClub(clubId); await reloadClubs(); router.replace('/clubs'); }
    catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); setDeleting(false); }
  }
  return <Screen>
    <Heading title="Capitanes" subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    {result.isLoading ? <Body>Cargando configuración…</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button secondary label="Reintentar" onPress={result.reload} /></> : null}
    {message ? <Message>{message}</Message> : null}
    {admin && !isDemo ? <CrestSettings /> : null}
    {data ? <>
      <Card title="Capitanes del club">
        <Body>Los capitanes pueden gestionar la plantilla, las convocatorias y los avisos. Solo el creador puede eliminar el club.</Body>
        {data.accounts.map(account => {
          const player = data.players.find(row => row.user_id === account.user_id);
          const creator = data.club.created_by === account.user_id;
          const name = player?.ea_id ?? account.profiles?.username ?? 'Miembro';
          return <Card key={account.id} title={name}>
            <Body>{creator ? 'Creador · capitán' : account.role === 'admin' ? 'Capitán' : 'Jugador'}</Body>
            {!creator && (player || account.role === 'admin') ? <Button secondary
              label={account.role === 'admin' ? `Quitar capitanía a ${name}` : `Designar capitán a ${name}`}
              disabled={busy || !admin} onPress={() => setPending({ userId: account.user_id, name, role: account.role === 'admin' ? 'player' : 'admin' })} /> : null}
            {!creator && !player && account.role !== 'admin' ? <Body>Vincula esta cuenta con una ficha activa para designarla capitán.</Body> : null}
          </Card>;
        })}
      </Card>
      {owner ? <Card title="Eliminar club"><Body>Se eliminarán la plantilla, las convocatorias y el historial de este club. Las cuentas de los jugadores se conservarán.</Body>
        <Button secondary label="Eliminar club" disabled={busy} onPress={() => setDeleting(true)} /></Card> : null}
    </> : null}
    <ConfirmDialog visible={Boolean(pending)} title={pending?.role === 'admin' ? 'Designar capitán' : 'Quitar capitanía'} description={`${pending?.name ?? ''}: ${pending?.role === 'admin' ? 'podrá administrar este club y crear convocatorias.' : 'conservará su cuenta y ficha como jugador.'}`} confirmLabel="Confirmar" busy={busy} onCancel={() => setPending(null)} onConfirm={() => { void changeCaptain(); }} />
    <ConfirmDialog visible={deleting} title="Eliminar el club definitivamente" description="Esta acción eliminará la plantilla, las convocatorias y su historial. No se puede deshacer. Las cuentas no se eliminarán." confirmLabel="Eliminar definitivamente" busy={busy} onCancel={() => setDeleting(false)} onConfirm={() => { void removeClub(); }} />
  </Screen>;
}
