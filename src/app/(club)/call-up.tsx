import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, Heading, Message, Options, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { categories, categoryLabels } from '@/features/players/categories';
import { AidsSection } from '@/features/call-ups/aids-section';
import { listCallUps, listCallUpPlayers, listCallUpTrials, respondToCallUp } from '@/features/call-ups/service';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
import { formatMatchDate } from '@/lib/format';
import type { Enums } from '@/types/database';
const labels = { available: 'Disponible', unanswered: 'Sin responder', unavailable: 'No disponible', backup: 'Backup' } as const;
export default function CallUpScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activeClub, currentMembership, upcomingCallUp, rosterVersion } = useClub(); const { session, isDemo } = useAuth();
  const clubId = activeClub?.id; const admin = currentMembership?.role === 'admin';
  const selectionScope = `${session?.user.id}:${clubId}:${id ?? ''}`;
  const [selection, setSelection] = useState<{ scope: string; id: string } | null>(null);
  const chosen = selection?.scope === selectionScope ? selection.id : null; const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const loadCalls = useCallback(() => clubId ? listCallUps(clubId) : Promise.resolve([]), [clubId]);
  const calls = useResource(`calls:${session?.user.id}:${clubId}:${rosterVersion}`, loadCalls, Boolean(session && clubId) && !isDemo);
  const call = calls.data?.find(row => row.id === (chosen ?? id)) ?? calls.data?.find(row => row.status === 'open') ?? calls.data?.[0];
  const callId = isDemo ? upcomingCallUp?.id : call?.id;
  const load = useCallback(async () => {
    if (!callId) return { players: [], trials: [] };
    const [players, trials] = await Promise.all([listCallUpPlayers(callId), listCallUpTrials(callId)]); return { players, trials };
  }, [callId]);
  const snapshots = useResource(`call-snapshot:${session?.user.id}:${clubId}:${callId}`, load, Boolean(session && callId) && !isDemo);
  const players = isDemo ? upcomingCallUp?.responses.map(row => ({ id: row.id, name: row.displayName, category: row.category, sortOrder: row.sortOrder, status: row.status, userId: null as string | null, jersey: null as number | null })) ?? []
    : snapshots.data?.players.map(row => ({ id: row.id, name: row.ea_id_snapshot, category: row.category_snapshot, sortOrder: row.sort_order_snapshot, status: row.availability, userId: row.user_id, jersey: row.jersey_number_snapshot })) ?? [];
  async function respond(entryId: string, availability: Enums<'availability_status'>) {
    if (isDemo || busy) return;
    setBusy(true); setMessage('');
    try { await respondToCallUp(entryId, availability); snapshots.reload(); } catch (error) { setMessage(backendErrorMessage(error)); } finally { setBusy(false); }
  }
  return <Screen>
    <Heading title="Convocatoria" subtitle={activeClub?.name ?? ''} />
    {admin ? <Button secondary label="Crear convocatoria" onPress={() => router.push('/create-call-up')} /> : null}
    {calls.data?.length ? <Options value={call?.id ?? ''} options={calls.data.map(row => ({ value: row.id, label: `${formatMatchDate(row.starts_at, row.timezone)} · ${row.status === 'open' ? 'Abierta' : row.status === 'closed' ? 'Cerrada' : row.status === 'draft' ? 'Borrador' : 'Cancelada'}` }))} onChange={value => setSelection({ scope: selectionScope, id: value })} /> : null}
    {calls.isLoading || snapshots.isLoading ? <Body>Cargando convocatoria…</Body> : null}
    {calls.error || snapshots.error ? <><Message error>{calls.error ?? snapshots.error}</Message><Button label="Reintentar" onPress={() => { calls.reload(); snapshots.reload(); }} /></> : null}
    {message ? <Message error>{message}</Message> : null}
    {callId ? <>
      <Body>{formatMatchDate(call?.starts_at ?? upcomingCallUp?.startsAt ?? '', call?.timezone ?? activeClub?.timezone)} · {call?.timezone ?? activeClub?.timezone}</Body>
      <Card title="Disponibilidad de la plantilla oficial">
        {snapshots.isLoading ? <Body>Cargando respuestas…</Body> : snapshots.error ? <Body>Respuestas no disponibles.</Body> : (['available', 'unavailable', 'backup', 'unanswered'] as const).map(status => <Body key={status}>{labels[status]}: {players.filter(player => player.status === status).length}</Body>)}
        <Body>PRUEBAS y AYUDAS no cuentan en estos totales.</Body>
      </Card>
      {categories.map(category => <Card key={category} title={categoryLabels[category]}>
        {players.filter(player => player.category === category).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map(player => <Card key={player.id} title={player.name}>
          <Body>{player.jersey === null ? 'Sin dorsal' : `Dorsal ${player.jersey}`} · {labels[player.status]}</Body>
          {!isDemo && call?.status === 'open' && player.userId === session?.user.id ? (['available', 'unavailable', 'backup'] as const).map(status => <Button secondary key={status} label={`Responder ${labels[status]}`} disabled={busy || snapshots.isLoading} onPress={() => { void respond(player.id, status); }} />) : null}
        </Card>)}
      </Card>)}
      <Card title="PRUEBAS · fotografía de la convocatoria">
        {snapshots.data?.trials.map(trial => <Card key={trial.id} title={trial.ea_id_snapshot}>
          <Body>{trial.jersey_number_snapshot === null ? 'Sin dorsal' : `Dorsal ${trial.jersey_number_snapshot}`} · {trial.position_snapshot ?? 'Posición sin indicar'}</Body>
          {trial.notes_snapshot ? <Body>{trial.notes_snapshot}</Body> : null}
        </Card>)}
        {!snapshots.isLoading && !snapshots.error && !snapshots.data?.trials.length ? <Body>No se incluyeron pruebas en esta convocatoria.</Body> : null}
      </Card>
      <AidsSection key={`${session?.user.id}:${clubId}:${callId}`} callUpId={callId} editable={admin && (isDemo || call?.status === 'open' || call?.status === 'draft')} />
      {isDemo ? <Body>Convocatoria simulada · los cambios no se guardan.</Body> : null}
    </> : !calls.isLoading && !calls.error ? <Body>No hay convocatorias accesibles en este club.</Body> : null}
  </Screen>;
}
