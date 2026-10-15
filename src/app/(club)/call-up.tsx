import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Heading, Message, Options, Screen } from '@/components/ui';
import { IconButton } from '@/components/icon-button';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { CompactRoster } from '@/features/call-ups/compact-roster';
import { AvailabilityActions } from '@/features/call-ups/availability-actions';
import { canRespondToPlayer } from '@/features/call-ups/list-model';
import type { CallUpPlayer } from '@/features/call-ups/list-model';
import { AidsSection } from '@/features/call-ups/aids-section';
import { CallUpAdministration } from '@/features/call-ups/administration';
import { availabilityLabels, callStatusLabels, responseOptions, callUpErrorMessage } from '@/features/call-ups/availability';
import { clubLocalDateTime } from '@/features/call-ups/local-time';
import { useCallUpSync } from '@/features/call-ups/use-call-up-sync';
import { getCallUp, listCurrentCallUps, listCallUpPlayers, listCallUpTrials, respondToCallUp } from '@/features/call-ups/service';
import { useResource } from '@/hooks/use-resource';
import { formatMatchDate } from '@/lib/format';
import { colors } from '@/theme';
import type { Tables } from '@/types/database';

export default function CallUpScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { activeClub, currentMembership, upcomingCallUp, roster, rosterVersion, refreshRoster } = useClub(); const { session, isDemo } = useAuth();
  const clubId = activeClub?.id; const admin = currentMembership?.role === 'admin';
  const scope = `${session?.user.id}:${clubId}:${isDemo}`;
  const selectionScope = `${scope}:${id ?? ''}`;
  const [selection, setSelection] = useState<{ scope: string; id: string } | null>(null);
  const [notice, setNotice] = useState('');
  const mutationLock = useRef(false);
  const [responseMessage, setResponseMessage] = useState<{ scope: string; text: string; error: boolean } | null>(null);
  const [pending, setPending] = useState<{ scope: string; id: string; availability: CallUpPlayer['availability']; saving: boolean; source: unknown } | null>(null);
  const [aidsRevision, setAidsRevision] = useState(0);
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
  const latestSnapshot = useRef(snapshots.data);
  useEffect(() => { latestSnapshot.current = snapshots.data; }, [snapshots.data]);
  const demoCall: Tables<'call_ups'> | null = isDemo && upcomingCallUp ? {
    id: upcomingCallUp.id, club_id: upcomingCallUp.clubId, starts_at: upcomingCallUp.startsAt,
    local_date: clubLocalDateTime(upcomingCallUp.timezone, new Date(upcomingCallUp.startsAt)).date,
    timezone: upcomingCallUp.timezone, status: 'open', created_by: null, created_at: upcomingCallUp.startsAt, updated_at: upcomingCallUp.startsAt,
  } : null;
  const call = isDemo ? demoCall : snapshots.data?.call;
  const sourcePlayers = useMemo<CallUpPlayer[]>(() => isDemo ? upcomingCallUp?.responses.map(row => ({ id: row.id, eaId: row.displayName, category: row.category, sortOrder: row.sortOrder, availability: row.status, userId: roster.find(player => player.id === row.id)?.userId ?? null, jersey: roster.find(player => player.id === row.id)?.jerseyNumber ?? null })) ?? []
    : snapshots.data?.players.map(row => ({ id: row.id, eaId: row.ea_id_snapshot, category: row.category_snapshot, sortOrder: row.sort_order_snapshot, availability: row.availability, userId: row.user_id, jersey: row.jersey_number_snapshot })) ?? [], [isDemo, upcomingCallUp?.responses, snapshots.data?.players, roster]);
  const responseScope = `${scope}:${callId}`;
  const currentPending = pending?.scope === responseScope ? pending : null;
  const players = useMemo(() => currentPending && (currentPending.saving || currentPending.source === snapshots.data) ? sourcePlayers.map(player => player.id === currentPending.id ? { ...player, availability: currentPending.availability } : player) : sourcePlayers, [sourcePlayers, currentPending, snapshots.data]);
  const { reload: reloadCalls } = calls; const { reload: reloadSnapshots } = snapshots;
  const refresh = useCallback(() => { reloadCalls(); reloadSnapshots(); setAidsRevision(value => value + 1); }, [reloadCalls, reloadSnapshots]);
  const syncStatus = useCallUpSync(scope, clubId, enabled, refresh);
  const respond = useCallback(async (entryId: string, availability: typeof responseOptions[number]) => {
    const player = sourcePlayers.find(row => row.id === entryId);
    if (mutationLock.current || !call || !player || snapshots.isLoading || snapshots.error || !canRespondToPlayer(player, session?.user.id, call, localDate, isDemo)) return;
    mutationLock.current = true;
    setPending({ scope: responseScope, id: entryId, availability, saving: true, source: snapshots.data });
    setResponseMessage({ scope: responseScope, text: 'Guardando respuesta…', error: false });
    try {
      const result = await respondToCallUp(entryId, availability);
      setPending({ scope: responseScope, id: entryId, availability: result.availability, saving: false, source: latestSnapshot.current });
      reloadSnapshots();
      setResponseMessage({ scope: responseScope, text: `Tu respuesta: ${availabilityLabels[result.availability]}.`, error: false });
    } catch (cause) {
      setPending(null);
      setResponseMessage({ scope: responseScope, text: callUpErrorMessage(cause), error: true });
      refresh();
    } finally { mutationLock.current = false; }
  }, [sourcePlayers, call, snapshots.isLoading, snapshots.error, snapshots.data, session?.user.id, localDate, isDemo, responseScope, reloadSnapshots, refresh]);
  const ownPlayer = players.find(player => player.userId === session?.user.id);
  const availabilityFooter = ownPlayer && call && !snapshots.error && canRespondToPlayer(ownPlayer, session?.user.id, call, localDate, isDemo)
    ? <AvailabilityActions player={ownPlayer} disabled={Boolean(currentPending?.saving) || snapshots.isLoading}
      feedback={responseMessage?.scope === responseScope ? responseMessage : null} onRespond={respond} /> : null;
  return <Screen compact footer={availabilityFooter}>
    <Heading title="Convocatoria" subtitle={activeClub?.name ?? ''} />
    <View style={styles.toolbar}>
      {admin ? <Pressable accessibilityRole="button" accessibilityLabel="Crear convocatoria" onPress={() => router.push('/create-call-up')} style={styles.create}>
        <Text style={styles.createLabel}>Crear convocatoria</Text>
      </Pressable> : null}
      {admin ? <IconButton icon="history" label="Historial de convocatorias" onPress={() => router.push('/call-up-history')} /> : null}
      {!isDemo ? <IconButton icon="refresh" label="Actualizar convocatoria" disabled={calls.isLoading || snapshots.isLoading} onPress={refresh} /> : null}
      {!isDemo ? <Text accessibilityLiveRegion="polite" style={styles.sync}>{syncStatus === 'live' ? 'Actualización en directo' : syncStatus === 'connecting' ? 'Conectando actualizaciones…' : 'Recuperando conexión. Puedes actualizar manualmente.'}</Text> : null}
    </View>
    {calls.data && calls.data.length > 1 ? <Options value={callId ?? ''} options={calls.data.map(row => ({ value: row.id, label: `${formatMatchDate(row.starts_at, row.timezone)} · ${callStatusLabels[row.status]}` }))} onChange={value => { setSelection({ scope: selectionScope, id: value }); setResponseMessage(null); setNotice(''); }} /> : null}
    {calls.isLoading || snapshots.isLoading ? <Body>Cargando convocatoria…</Body> : null}
    {calls.error || snapshots.error ? <><Message error>{calls.error ?? snapshots.error}</Message><Button label="Reintentar" onPress={refresh} /></> : null}
    {responseMessage?.scope === responseScope && !availabilityFooter ? <Message error={responseMessage.error}>{responseMessage.text}</Message> : null}
    {notice ? <Message>{notice}</Message> : null}
    {call ? <>
      <Text style={styles.date}>{formatMatchDate(call.starts_at, call.timezone)} · {call.timezone} · {callStatusLabels[call.status]}</Text>
      {admin ? <CallUpAdministration key={`${scope}:${call.id}:${call.updated_at}`} call={call} onSaved={() => { setNotice('Convocatoria actualizada. La fotografía y respuestas se conservan.'); refreshRoster(); refresh(); }} /> : null}
      {snapshots.error ? <Body>Respuestas no disponibles.</Body> : <CompactRoster key={responseScope} players={players}
        trials={snapshots.data?.trials ?? []}
        aids={<AidsSection key={responseScope} callUpId={call.id} revision={aidsRevision} editable={admin && (call.status === 'open' || call.status === 'draft')} />} />}
      {isDemo ? <Body>Convocatoria simulada · los cambios no se guardan.</Body> : null}
    </> : !calls.isLoading && !snapshots.isLoading && !calls.error && !snapshots.error ? <Body>No hay convocatorias accesibles en este club.</Body> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  create: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.primary },
  createLabel: { color: colors.background, fontWeight: '700', fontSize: 13 },
  sync: { color: colors.muted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  date: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
