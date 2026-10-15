import { useCallback, useState } from 'react';
import { Switch } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Card, DemoNotice, Heading, Message, Options, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { deleteClub, getClubSettings, listClubAccounts, setClubMember, updateClubReminder } from '@/features/clubs/service';
import { reminderMinutes, reminderOptions } from '@/features/clubs/reminders';
import { listPlayers } from '@/features/players/service';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
import { colors } from '@/theme';

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
  const [selectedMinutes, setSelectedMinutes] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [choosingTime, setChoosingTime] = useState(false);
  const [pending, setPending] = useState<{ userId: string; name: string; role: 'admin' | 'player' } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const admin = currentMembership?.role === 'admin';
  const data = result.data;
  const owner = data?.club.created_by === session?.user.id;
  const minutes = selectedMinutes ?? String(data?.club.reminder_minutes ?? 60);
  const reminderEnabled = enabled ?? (data?.club.reminder_minutes != null);

  async function saveReminder() {
    if (!clubId || !admin || isDemo || busy) return;
    setBusy(true); setMessage('');
    try {
      await updateClubReminder(clubId, reminderMinutes(reminderEnabled, minutes));
      setMessage('Configuración de avisos guardada.'); result.reload();
    } catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); }
  }
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
    <Heading title="Capitanes y avisos" subtitle={activeClub?.name ?? ''} />
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
      <Card title="Avisos de convocatoria">
        <Body>Notificar a los jugadores antes de la convocatoria</Body>
        <Switch accessibilityLabel="Notificar a los jugadores antes de la convocatoria" value={reminderEnabled} onValueChange={setEnabled} disabled={busy || !admin} trackColor={{ true: colors.primary }} />
        {reminderEnabled ? <>
          <Button secondary label={`Antelación: ${reminderOptions.find(option => option.value === minutes)?.label ?? 'Seleccionar'}`} disabled={busy} onPress={() => setChoosingTime(!choosingTime)} />
          {choosingTime ? <Options value={minutes} options={[...reminderOptions]} disabled={busy} onChange={value => { setSelectedMinutes(value); setChoosingTime(false); }} /> : null}
          <Body>Se avisará a todos los jugadores registrados de la convocatoria con notificaciones activas, aunque ya hayan respondido. PRUEBAS y AYUDAS no reciben avisos.</Body>
        </> : null}
        <Button label="Guardar avisos" disabled={busy || !admin} onPress={() => { void saveReminder(); }} />
        <Body>Los avisos automáticos requieren el servicio de envío configurado en el servidor.</Body>
      </Card>
      {owner ? <Card title="Eliminar club"><Body>Se eliminarán la plantilla, las convocatorias y el historial de este club. Las cuentas de los jugadores se conservarán.</Body>
        <Button secondary label="Eliminar club" disabled={busy} onPress={() => setDeleting(true)} /></Card> : null}
    </> : null}
    <ConfirmDialog visible={Boolean(pending)} title={pending?.role === 'admin' ? 'Designar capitán' : 'Quitar capitanía'} description={`${pending?.name ?? ''}: ${pending?.role === 'admin' ? 'podrá administrar este club y crear convocatorias.' : 'conservará su cuenta y ficha como jugador.'}`} confirmLabel="Confirmar" busy={busy} onCancel={() => setPending(null)} onConfirm={() => { void changeCaptain(); }} />
    <ConfirmDialog visible={deleting} title="Eliminar el club definitivamente" description="Esta acción eliminará la plantilla, las convocatorias y su historial. No se puede deshacer. Las cuentas no se eliminarán." confirmLabel="Eliminar definitivamente" busy={busy} onCancel={() => setDeleting(false)} onConfirm={() => { void removeClub(); }} />
  </Screen>;
}
