import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, Message } from '@/components/ui';
import { ReorderButtons } from '@/components/reorder-buttons';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { moveItem } from '@/features/players/categories';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
import { listTrials, reorderTrials } from './service';
export function TrialSection() {
  const { session, isDemo } = useAuth();
  const { activeClub, currentMembership, rosterVersion } = useClub();
  const clubId = activeClub?.id;
  const admin = currentMembership?.role === 'admin';
  const load = useCallback(() => clubId ? listTrials(clubId, admin) : Promise.resolve([]), [clubId, admin]);
  const trials = useResource(`trials:${session?.user.id}:${clubId}:${admin}:${rosterVersion}`, load, Boolean(session && clubId) && !isDemo);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const active = trials.data?.filter(trial => trial.status === 'active') ?? [];
  async function move(id: string, direction: -1 | 1) {
    if (!clubId || isDemo || busy) return;
    const ids = moveItem(active.map(trial => trial.id), id, direction); if (!ids) return;
    setBusy(true); setMessage('');
    try { await reorderTrials(clubId, ids); trials.reload(); }
    catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); }
  }
  return <Card title="PRUEBAS">
    <Body>Jugadores a prueba del club. No cuentan en los totales de disponibilidad.</Body>
    {admin ? <Button secondary label="Añadir jugador a prueba" onPress={() => router.push({ pathname: '/trials/[id]', params: { id: 'new' } })} /> : null}
    {trials.isLoading ? <Body>Cargando pruebas…</Body> : null}
    {trials.error ? <><Message error>{trials.error}</Message><Button secondary label="Reintentar pruebas" onPress={trials.reload} /></> : null}
    {message ? <Message error>{message}</Message> : null}
    {trials.data?.map(trial => <Card key={trial.id} title={trial.ea_id}>
      <Body>{trial.jersey_number === null ? 'Sin dorsal' : `Dorsal ${trial.jersey_number}`} · {trial.position ?? 'Posición sin indicar'}</Body>
      {trial.notes ? <Body>{trial.notes}</Body> : null}
      <Body>Desde {new Date(trial.created_at).toLocaleDateString('es-ES', { timeZone: activeClub?.timezone ?? 'Europe/Madrid' })} · {trial.status === 'active' ? 'En pruebas' : trial.status === 'withdrawn' ? 'Retirado de pruebas' : 'Incorporado a la plantilla'}</Body>
      {admin && trial.player_id ? <Button secondary label="Ver ficha incorporada" onPress={() => router.push({ pathname: '/players/[id]', params: { id: trial.player_id! } })} /> : null}
      {admin && trial.status === 'active' ? <>
        <Button secondary label={`Gestionar prueba de ${trial.ea_id}`} onPress={() => router.push({ pathname: '/trials/[id]', params: { id: trial.id } })} />
        <ReorderButtons label={`prueba de ${trial.ea_id}`} first={active[0]?.id === trial.id} last={active.at(-1)?.id === trial.id} disabled={busy || isDemo || trials.isLoading} move={direction => { void move(trial.id, direction); }} />
      </> : null}
    </Card>)}
    {!trials.isLoading && !trials.error && !active.length ? <Body>No hay jugadores en pruebas activos.</Body> : null}
  </Card>;
}
