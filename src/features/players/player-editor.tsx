import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, DemoNotice, Field, Heading, Message, Options, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { listClubAccounts } from '@/features/clubs/service';
import { createPlayer, linkPlayerAccount, listPlayers, updatePlayer } from './service';
import { categories, categoryLabels } from './categories';
import type { RosterCategory } from './categories';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
import { PlayerActivityDialog } from './player-activity-dialog';

export type EditablePlayer = { id: string; eaId: string; jerseyNumber: number | null; category: RosterCategory; userId: string | null; isActive: boolean };
export function PlayerEditor({ player = null }: { player?: EditablePlayer | null }) {
  const { session, isDemo } = useAuth();
  const { activeClub, currentMembership, refreshRoster } = useClub();
  const clubId = activeClub?.id;
  const admin = currentMembership?.role === 'admin';
  const [eaId, setEaId] = useState(player?.eaId ?? '');
  const [jersey, setJersey] = useState(player?.jerseyNumber?.toString() ?? '');
  const [category, setCategory] = useState<RosterCategory>(player?.category ?? 'midfielders');
  const [linkedUserId, setLinkedUserId] = useState(player?.userId ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingLink, setPendingLink] = useState<{ userId: string; username: string } | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const loadAccounts = useCallback(async () => {
    if (!clubId) return { members: [], players: [] };
    const [members, players] = await Promise.all([listClubAccounts(clubId), listPlayers(clubId, true)]);
    return { members, players };
  }, [clubId]);
  const accounts = useResource(`link-accounts:${session?.user.id}:${clubId}:${player?.id}`, loadAccounts, Boolean(session && clubId && player && !linkedUserId) && !isDemo);

  async function save() {
    if (!clubId || !admin || isDemo || busy) return;
    const trimmed = eaId.trim();
    if (!trimmed || trimmed.length > 64) return setMessage('El EA ID debe tener entre 1 y 64 caracteres.');
    if (jersey.trim() && (!/^[0-9]{1,2}$/.test(jersey.trim()) || Number(jersey) < 1 || Number(jersey) > 99)) return setMessage('El dorsal debe estar entre 1 y 99 o quedar vacío.');
    setBusy(true);
    setMessage('');
    try {
      if (player) await updatePlayer(player.id, { ea_id: trimmed, jersey_number: jersey.trim() ? Number(jersey) : null, category });
      else await createPlayer(clubId, { eaId: trimmed, ...(jersey.trim() ? { jerseyNumber: Number(jersey) } : {}), category });
      refreshRoster();
      router.replace(player && !player.isActive ? '/inactive-players' : '/roster');
    } catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); }
  }
  async function link() {
    if (!player || !admin || !pendingLink || isDemo || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await linkPlayerAccount(player.id, pendingLink.userId);
      setLinkedUserId(result.user_id);
      setMessage('Cuenta vinculada. Se conserva la ficha, su dorsal, posición y EA ID.');
      refreshRoster();
    } catch (error) { setMessage(backendErrorMessage(error)); accounts.reload(); }
    finally { setBusy(false); setPendingLink(null); }
  }
  const dirty = Boolean(player && (eaId.trim() !== player.eaId || jersey.trim() !== (player.jerseyNumber?.toString() ?? '') || category !== player.category));
  const freeAccounts = accounts.data?.members.filter((member) => !accounts.data?.players.some((existing) => existing.user_id === member.user_id)) ?? [];
  return <Screen>
    <Heading title={player ? 'Editar ficha' : 'Añadir jugador'} subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    <Field label="ID de EA Sports FC" value={eaId} onChangeText={setEaId} maxLength={64} autoCapitalize="none" editable={!busy} />
    <Field label="Dorsal (opcional)" value={jersey} onChangeText={setJersey} maxLength={2} keyboardType="number-pad" editable={!busy} />
    <Body>Categoría principal · {categoryLabels[category]}</Body>
    <Options value={category} options={categories.map((value) => ({ value, label: categoryLabels[value] }))} onChange={setCategory} disabled={busy} />
    {player && !player.isActive ? <Message>Jugador inactivo · no se incluye en nuevas convocatorias.</Message> : null}
    <Body>{linkedUserId ? 'Registrado · cuenta vinculada' : 'Sin registrar · la ficha es independiente de una cuenta'}</Body>
    {message ? <Message>{message}</Message> : null}
    <Button label={busy ? 'Guardando…' : 'Guardar jugador'} disabled={busy || isDemo || !admin} onPress={() => { void save(); }} />
    {player && admin ? <>
      {dirty ? <Body>Guarda los cambios de ficha antes de quitar o reincorporar al jugador.</Body> : null}
      <Button secondary label={player.isActive ? 'Quitar de la plantilla' : 'Reincorporar a la plantilla'} disabled={busy || isDemo || dirty} onPress={() => setDeactivating(true)} />
      {!linkedUserId ? <Card title="Vincular con una cuenta">
        <Body>Elige un miembro activo del club que todavía no tenga una ficha vinculada. No se creará otro jugador.</Body>
        {dirty ? <Body>Guarda los cambios de ficha antes de vincular la cuenta.</Body> : null}
        {accounts.isLoading ? <Body>Cargando miembros…</Body> : null}
        {accounts.error ? <><Message error>{accounts.error}</Message><Button secondary label="Reintentar" onPress={accounts.reload} /></> : null}
        {freeAccounts.map((member) => <Button secondary key={member.id} disabled={busy || isDemo || dirty}
          label={`Vincular con ${member.profiles?.username ?? 'miembro del club'}`} onPress={() => setPendingLink({ userId: member.user_id, username: member.profiles?.username ?? 'miembro del club' })} />)}
        {!isDemo && accounts.data && freeAccounts.length === 0 ? <Body>No hay miembros activos sin ficha. Aprueba su incorporación antes de vincularlos.</Body> : null}
      </Card> : null}
    </> : null}
    <ConfirmDialog visible={Boolean(pendingLink)} title="Vincular esta ficha" description={`${eaId} se vinculará con ${pendingLink?.username ?? ''}. Esta cuenta será la titular de la ficha.`}
      confirmLabel="Vincular cuenta" busy={busy} onCancel={() => setPendingLink(null)} onConfirm={() => { void link(); }} />
    {deactivating && player && admin ? <PlayerActivityDialog key={`${session?.user.id}:${clubId}:${player.id}`} player={player}
      onCancel={() => setDeactivating(false)} onSuccess={() => {
        setDeactivating(false);
        router.replace({ pathname: player.isActive ? '/roster' : '/inactive-players', params: { activity: player.isActive ? 'removed' : 'restored' } });
      }} /> : null}
  </Screen>;
}
