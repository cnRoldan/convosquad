import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, Heading, Message, Options, Screen } from '@/components/ui';
import { IconButton } from '@/components/icon-button';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { categories, categoryLabels } from '@/features/players/categories';
import { AidsSection } from '@/features/call-ups/aids-section';
import { CallUpAdministration } from '@/features/call-ups/administration';
import { availabilityLabels, callStatusLabels, countAvailability, responseOptions, callUpErrorMessage } from '@/features/call-ups/availability';
import { clubLocalDateTime } from '@/features/call-ups/local-time';
import { useCallUpSync } from '@/features/call-ups/use-call-up-sync';
import { getCallUp, listCurrentCallUps, listCallUpPlayers, listCallUpTrials, respondToCallUp } from '@/features/call-ups/service';
import { useResource } from '@/hooks/use-resource';
import { formatMatchDate } from '@/lib/format';
import type { Tables } from '@/types/database';

export default function CallUpScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activeClub, currentMembership, upcomingCallUp, rosterVersion, refreshRoster } = useClub(); const { session, isDemo } = useAuth();
  const clubId = activeClub?.id; const admin = currentMembership?.role === 'admin';
  const scope = `${session?.user.id}:${clubId}:${isDemo}`;
  const selectionScope = `${scope}:${id ?? ''}`;
  const [selection, setSelection] = useState<{ scope: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending'>('all'); const [aidsRevision, setAidsRevision] = useState(0);
  const localDate = clubLocalDateTime(activeClub?.timezone ?? 'Europe/Madrid').date;
  const enabled = Boolean(session && clubId && !isDemo);
  const loadCalls = useCallback(() => clubId ? listCurrentCallUps(clubId, localDate) : Promise.resolve([]), [clubId, localDate]);
  const calls = useResource(`calls:${scope}:${localDate}:${rosterVersion}`, loadCalls, enabled);
  const chosen = selection?.scope === selectionScope ? selection.id : id;
  const callId = isDemo ? upcomingCallUp?.id : chosen ?? calls.data?.find(row => row.status === 'open')?.id ?? calls.data?.[0]?.id;
  const load = useCallback(async () => {
    if (!clubId || !callId) return null;
    const call = await getCallUp(clubId, callId);
    const [players, trials] = await Promise.all([listCallUpPlayers(callId), listCallUpTrials(callId)]);
    return { call, players, trials };
  }, [clubId, callId]);
  const snapshots = useResource(`call-snapshot:${scope}:${callId}:${rosterVersion}`, load, enabled && Boolean(callId));
  const demoCall: Tables<'call_ups'> | null = isDemo && upcomingCallUp ? {
    id: upcomingCallUp.id, club_id: upcomingCallUp.clubId, starts_at: upcomingCallUp.startsAt,
    local_date: clubLocalDateTime(upcomingCallUp.timezone, new Date(upcomingCallUp.startsAt)).date,
    timezone: upcomingCallUp.timezone, status: 'open', created_by: null, created_at: upcomingCallUp.startsAt, updated_at: upcomingCallUp.startsAt,
  } : null;
  const call = isDemo ? demoCall : snapshots.data?.call;
  const players = isDemo ? upcomingCallUp?.responses.map(row => ({ id: row.id, eaId: row.displayName, category: row.category, sortOrder: row.sortOrder, availability: row.status, userId: null as string | null, jersey: null as number | null })) ?? []
    : snapshots.data?.players.map(row => ({ id: row.id, eaId: row.ea_id_snapshot, category: row.category_snapshot, sortOrder: row.sort_order_snapshot, availability: row.availability, userId: row.user_id, jersey: row.jersey_number_snapshot })) ?? [];
  const counts = countAvailability(players);
  const { reload: reloadCalls } = calls; const { reload: reloadSnapshots } = snapshots;
  const refresh = useCallback(() => { reloadCalls(); reloadSnapshots(); setAidsRevision(value => value + 1); }, [reloadCalls, reloadSnapshots]);
  const syncStatus = useCallUpSync(scope, clubId, enabled, refresh);
  async function respond(entryId: string, availability: typeof responseOptions[number]) {
    if (isDemo || busy || call?.status !== 'open') return;
    setBusy(true); setError(''); setNotice('');
    try { await respondToCallUp(entryId, availability); snapshots.reload(); setNotice(`Tu respuesta: ${availabilityLabels[availability]}.`); }
    catch (cause) { setError(callUpErrorMessage(cause)); refresh(); }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading title="Convocatoria" subtitle={activeClub?.name ?? ''} />
    {admin ? <Button secondary label="Crear convocatoria" onPress={() => router.push('/create-call-up')} /> : null}
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {admin ? <IconButton icon="history" label="Historial de convocatorias" onPress={() => router.push('/call-up-history')} /> : null}
      {!isDemo ? <IconButton icon="refresh" label="Actualizar convocatoria" disabled={calls.isLoading || snapshots.isLoading} onPress={refresh} /> : null}
    </View>
    {!isDemo ? <Body>{syncStatus === 'live' ? 'Actualización en directo' : syncStatus === 'connecting' ? 'Conectando actualizaciones…' : 'Recuperando conexión. Puedes actualizar los datos manualmente.'}</Body> : null}
    {calls.data?.length ? <Options value={callId ?? ''} options={calls.data.map(row => ({ value: row.id, label: `${formatMatchDate(row.starts_at, row.timezone)} · ${callStatusLabels[row.status]}` }))} onChange={value => { setSelection({ scope: selectionScope, id: value }); setError(''); setNotice(''); }} /> : null}
    {calls.isLoading || snapshots.isLoading ? <Body>Cargando convocatoria…</Body> : null}
    {calls.error || snapshots.error ? <><Message error>{calls.error ?? snapshots.error}</Message><Button label="Reintentar" onPress={refresh} /></> : null}
    {error ? <Message error>{error}</Message> : null}
    {notice ? <Message>{notice}</Message> : null}
    {call ? <>
      <Body>{formatMatchDate(call.starts_at, call.timezone)} · {call.timezone} · {callStatusLabels[call.status]}</Body>
      {admin ? <CallUpAdministration key={`${scope}:${call.id}:${call.updated_at}`} call={call} onSaved={() => { setNotice('Convocatoria actualizada. La fotografía y respuestas se conservan.'); refreshRoster(); refresh(); }} /> : null}
      <Card title="Disponibilidad de la plantilla oficial">
        {snapshots.isLoading ? <Body>Cargando respuestas…</Body> : snapshots.error ? <Body>Respuestas no disponibles.</Body> : (['available', 'unavailable', 'backup', 'unanswered'] as const).map(status => <Body key={status}>{availabilityLabels[status]}: {counts[status]}</Body>)}
        <Body>PRUEBAS y AYUDAS no cuentan en estos totales. Disponible no significa seleccionado para el once titular.</Body>
      </Card>
      {admin ? <Options value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Toda la plantilla' }, { value: 'pending', label: `Pendientes (${counts.unanswered})` }]} /> : null}
      {categories.map(category => <Card key={category} title={categoryLabels[category]}>
        {players.filter(player => player.category === category && (!admin || filter !== 'pending' || player.availability === 'unanswered')).sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)).map(player => <Card key={player.id} title={player.eaId}>
          <Body>{player.jersey === null ? 'Sin dorsal' : `Dorsal ${player.jersey}`} · {player.userId ? 'Registrado' : 'Sin registrar'} · {availabilityLabels[player.availability]}</Body>
          {!isDemo && call.status === 'open' && call.local_date >= localDate && player.userId === session?.user.id ? <Options value={player.availability} options={responseOptions.map(status => ({ value: status, label: availabilityLabels[status] }))} disabled={busy || snapshots.isLoading} onChange={status => { if (status !== 'unanswered') void respond(player.id, status); }} /> : null}
        </Card>)}
      </Card>)}
      <Card title="PRUEBAS · fotografía de la convocatoria">
        {snapshots.data?.trials.map(trial => <Card key={trial.id} title={trial.ea_id_snapshot}>
          <Body>{trial.jersey_number_snapshot === null ? 'Sin dorsal' : `Dorsal ${trial.jersey_number_snapshot}`} · {trial.position_snapshot ?? 'Posición sin indicar'}</Body>
          {trial.notes_snapshot ? <Body>{trial.notes_snapshot}</Body> : null}
        </Card>)}
        {!snapshots.isLoading && !snapshots.error && !snapshots.data?.trials.length ? <Body>No se incluyeron pruebas en esta convocatoria.</Body> : null}
      </Card>
      <AidsSection key={`${scope}:${call.id}`} callUpId={call.id} revision={aidsRevision} editable={admin && (call.status === 'open' || call.status === 'draft')} />
      {isDemo ? <Body>Convocatoria simulada · los cambios no se guardan.</Body> : null}
    </> : !calls.isLoading && !snapshots.isLoading && !calls.error && !snapshots.error ? <Body>No hay convocatorias accesibles en este club.</Body> : null}
  </Screen>;
}
