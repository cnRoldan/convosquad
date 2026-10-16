import { useCallback, useState } from 'react';
import { Body, Button, Card, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { getClubSettings, listClubAccounts, setClubMember } from '@/features/clubs/service';
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
  const admin = currentMembership?.role === 'admin';
  const data = result.data;
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
  return <Screen>
    <Heading title="Capitanes" subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    {result.isLoading ? <Body>Cargando configuración…</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button secondary label="Reintentar" onPress={result.reload} /></> : null}
    {message ? <Message>{message}</Message> : null}
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
    </> : null}
    <ConfirmDialog visible={Boolean(pending)} title={pending?.role === 'admin' ? 'Designar capitán' : 'Quitar capitanía'} description={`${pending?.name ?? ''}: ${pending?.role === 'admin' ? 'podrá administrar este club y crear convocatorias.' : 'conservará su cuenta y ficha como jugador.'}`} confirmLabel="Confirmar" busy={busy} onCancel={() => setPending(null)} onConfirm={() => { void changeCaptain(); }} />
  </Screen>;
}
