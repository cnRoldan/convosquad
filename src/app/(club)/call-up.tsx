import { t, useLanguage } from '@/features/i18n/runtime';
import { endInstant } from '@/features/call-ups/end-time';
import { callUpHasEnded, callUpStatusLabel } from '@/features/call-ups/lifecycle';
import { votingDeadlinePassed } from '@/features/call-ups/closing-time';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Heading, Message, Options, Screen } from '@/components/ui';
import { IconButton } from '@/components/icon-button';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { CompactRoster } from '@/features/call-ups/compact-roster';
import { responseCooldown } from '@/features/call-ups/last-notice';
import { DecisionLock } from '@/features/call-ups/decision-lock';
import { AvailabilityActions } from '@/features/call-ups/availability-actions';
import { canRespondToPlayer } from '@/features/call-ups/list-model';
import type { CallUpPlayer } from '@/features/call-ups/list-model';
import { listCallUpContacts } from '@/features/call-ups/contacts';
import { CallUpTrialActions } from '@/features/trials/call-up-trial-actions';
import { CallUpTrialForm } from '@/features/trials/call-up-trial-form';
import { AidsSection } from '@/features/call-ups/aids-section';
import { CallUpAdministration } from '@/features/call-ups/administration';
import { availabilityLabels, responseOptions, callUpErrorMessage } from '@/features/call-ups/availability';
import { clubLocalDateTime } from '@/features/call-ups/local-time';
import { useCallUpSync } from '@/features/call-ups/use-call-up-sync';
import { getCallUp, listCurrentCallUps, listCallUpPlayers, listCallUpTrials, respondToCallUp } from '@/features/call-ups/service';
import { useResource } from '@/hooks/use-resource';
import { formatMatchDate } from '@/lib/format';
import { colors } from '@/theme';
import type { Tables } from '@/types/database';

export default function CallUpScreen() {
  useLanguage();
  const { id: routeId, history } = useLocalSearchParams<{ id?: string; history?: string }>();
  const id = routeId || undefined;
  const { activeClub, currentMembership, upcomingCallUp, roster, rosterVersion, refreshRoster } = useClub(); const { session, isDemo } = useAuth();
  const clubId = activeClub?.id; const admin = currentMembership?.role === 'admin';
  const scope = `${session?.user.id}:${clubId}:${isDemo}`;
  const selectionScope = `${scope}:${id ?? ''}`;
  const [deletedCallIds, setDeletedCallIds] = useState<string[]>([]);
  const [selection, setSelection] = useState<{ scope: string; id: string } | null>(null);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const [lastResponse, setLastResponse] = useState<{ scope: string; at: string } | null>(null);
  const [notice, setNotice] = useState('');
  const mutationLock = useRef(false);
  const [responseMessage, setResponseMessage] = useState<{ scope: string; text: string; availability?: CallUpPlayer['availability']; error: boolean } | null>(null);
  const [pending, setPending] = useState<{ scope: string; id: string; availability: CallUpPlayer['availability']; saving: boolean; source: unknown } | null>(null);
  const [aidsRevision, setAidsRevision] = useState(0);
  const localDate = clubLocalDateTime(activeClub?.timezone ?? 'Europe/Madrid').date;
  const enabled = Boolean(session && clubId && !isDemo);
  const loadCalls = useCallback(() => clubId ? listCurrentCallUps(clubId) : Promise.resolve([]), [clubId]);
  const calls = useResource(`calls:${scope}:${localDate}:${rosterVersion}`, loadCalls, enabled);
  // Discard deleted IDs even before the list refresh and route updates finish.
  const availableCalls = calls.data?.filter(row => !deletedCallIds.includes(row.id) && !callUpHasEnded(row, clock));
  const candidate = selection?.scope === selectionScope ? selection.id : id;
  const chosen = candidate && !deletedCallIds.includes(candidate) ? candidate : undefined;
  const callId = isDemo ? upcomingCallUp?.id : chosen ?? availableCalls?.find(row => row.status === 'open' || row.status === 'closed')?.id ?? availableCalls?.[0]?.id;
  const load = useCallback(async () => {
    if (!clubId || !callId) return null;
    const call = await getCallUp(clubId, callId);
    const [players, trials] = await Promise.all([listCallUpPlayers(callId), listCallUpTrials(callId, admin)]);
    return { call, players, trials };
  }, [clubId, callId, admin]);
  const snapshots = useResource(`call-snapshot:${scope}:${admin}:${callId}:${rosterVersion}`, load, enabled && Boolean(callId));
  const loadContacts = useCallback(() => callId ? listCallUpContacts(callId) : Promise.resolve([]), [callId]);
  const contacts = useResource(`contacts:${scope}:${callId}:${rosterVersion}`, loadContacts, enabled && admin && Boolean(callId));
  const latestSnapshot = useRef(snapshots.data);
  useEffect(() => { latestSnapshot.current = snapshots.data; }, [snapshots.data]);
  const demoCall: Tables<'call_ups'> | null = isDemo && upcomingCallUp ? {
    id: upcomingCallUp.id, club_id: upcomingCallUp.clubId, starts_at: upcomingCallUp.startsAt,
    local_date: clubLocalDateTime(upcomingCallUp.timezone, new Date(upcomingCallUp.startsAt)).date,
    ends_at: upcomingCallUp.endsAt ?? endInstant(clubLocalDateTime(upcomingCallUp.timezone, new Date(upcomingCallUp.startsAt)).date, '00:00', upcomingCallUp.timezone, upcomingCallUp.startsAt), evaluation_at: null, status_version: 0, last_notice_at: null, closes_at: null, timezone: upcomingCallUp.timezone, status: 'open', created_by: null, created_at: upcomingCallUp.startsAt, updated_at: upcomingCallUp.startsAt,
  } : null;
  const call = isDemo ? demoCall : snapshots.data?.call;
  const historical = history === '1' || Boolean(call && callUpHasEnded(call, clock));
  function returnToCurrent() {
    setSelection(null); setResponseMessage(null); setNotice('');
    router.setParams({ id: undefined, history: undefined });
  }
  const sourcePlayers = useMemo<CallUpPlayer[]>(() => isDemo ? upcomingCallUp?.responses.map(row => ({ id: row.id, eaId: row.displayName, category: row.category, sortOrder: row.sortOrder, availability: row.status, userId: roster.find(player => player.id === row.id)?.userId ?? null, jersey: roster.find(player => player.id === row.id)?.jerseyNumber ?? null })) ?? []
    : snapshots.data?.players.map(row => ({ id: row.id, eaId: row.ea_id_snapshot, category: row.category_snapshot, sortOrder: row.sort_order_snapshot, availability: row.availability, userId: row.user_id, jersey: row.jersey_number_snapshot, decisionLocked: Boolean(row.decision_locked) })) ?? [], [isDemo, upcomingCallUp?.responses, snapshots.data?.players, roster]);
  const responseScope = `${scope}:${callId}`;
  const currentPending = pending?.scope === responseScope ? pending : null;
  const players = useMemo(() => currentPending && (currentPending.saving || currentPending.source === snapshots.data) ? sourcePlayers.map(player => player.id === currentPending.id ? { ...player, availability: currentPending.availability } : player) : sourcePlayers, [sourcePlayers, currentPending, snapshots.data]);
  const { reload: reloadCalls } = calls; const { reload: reloadSnapshots } = snapshots; const { reload: reloadContacts } = contacts;
  const refresh = useCallback(() => { reloadCalls(); reloadSnapshots(); reloadContacts(); setAidsRevision(value => value + 1); }, [reloadCalls, reloadSnapshots, reloadContacts]);
  function handleDeleted(deletedId: string) {
    setDeletedCallIds(ids => [...ids, deletedId]);
    returnToCurrent();
    setLastResponse(null); setPending(null);
    setNotice('Convocatoria eliminada.');
    refreshRoster(); reloadCalls();
  }
  useCallUpSync(scope, clubId, enabled, refresh);
  const respond = useCallback(async (entryId: string, availability: typeof responseOptions[number]) => {
    const player = sourcePlayers.find(row => row.id === entryId);
    if (historical || mutationLock.current || !call || !player || snapshots.isLoading || snapshots.error || !canRespondToPlayer(player, session?.user.id, call, clubLocalDateTime(call.timezone).date, isDemo)) return;
    const ownSnapshot = snapshots.data?.players.find(row => row.id === entryId);
    if (Math.max(responseCooldown(lastResponse?.scope === responseScope ? lastResponse.at : null), responseCooldown(ownSnapshot?.auto_response ? null : ownSnapshot?.responded_at))) return;
    mutationLock.current = true;
    setPending({ scope: responseScope, id: entryId, availability, saving: true, source: snapshots.data });
    setResponseMessage({ scope: responseScope, text: "Guardando respuesta…", error: false });
    try {
      const result = await respondToCallUp(entryId, availability);
      setPending({ scope: responseScope, id: entryId, availability: result.availability, saving: false, source: latestSnapshot.current });
      if (result.responded_at) setLastResponse({ scope: responseScope, at: result.responded_at });
      reloadSnapshots();
      setResponseMessage({ scope: responseScope, text: "Tu respuesta: {{v0}}.", availability: result.availability, error: false });
    } catch (cause) {
      setPending(null);
      setResponseMessage({ scope: responseScope, text: callUpErrorMessage(cause), error: true });
      refresh();
    } finally { mutationLock.current = false; }
  }, [historical, sourcePlayers, call, snapshots.isLoading, snapshots.error, snapshots.data, session?.user.id, isDemo, responseScope, reloadSnapshots, refresh, lastResponse]);
  const ownPlayer = players.find(player => player.userId === session?.user.id);
  const ownSnapshot = snapshots.data?.players.find(row => row.user_id === session?.user.id);
  const remaining = Math.max(responseCooldown(lastResponse?.scope === responseScope ? lastResponse.at : null, clock), responseCooldown(ownSnapshot?.auto_response ? null : ownSnapshot?.responded_at, clock));
  // Keep keys and domain values in state; translate only when rendering so
  // existing feedback follows language changes, even after the vote is closed.
  const responseFeedback = responseMessage?.scope === responseScope ? {
    ...responseMessage,
    text: t(responseMessage.text, responseMessage.availability ? { v0: t(availabilityLabels[responseMessage.availability]) } : undefined),
  } : null;
  const votingClosed = Boolean(call && (call.status === 'closed' || (call.status === 'open' && (votingDeadlinePassed(call, clock) || callUpHasEnded(call, clock)))));
  const decisionLock = !isDemo && !historical && clubId && call && ownPlayer && !snapshots.error ? <DecisionLock votingClosed={votingClosed} clubId={clubId} entryId={ownPlayer?.id}
    availability={ownPlayer?.availability ?? 'unanswered'} canEnable={Boolean(ownPlayer && ownPlayer.availability !== 'unanswered' && call?.status !== 'cancelled')}
    pendingVote={Boolean(currentPending?.saving)} revision={ownSnapshot?.updated_at ?? ''} onChanged={reloadSnapshots} /> : null;
  const availabilityFooter = !historical && ownPlayer && call && !snapshots.error && (votingClosed || canRespondToPlayer(ownPlayer, session?.user.id, call, clubLocalDateTime(call.timezone).date, isDemo, clock))
    ? <AvailabilityActions votingClosed={votingClosed} decisionLock={decisionLock} player={ownPlayer} disabled={Boolean(currentPending?.saving) || snapshots.isLoading || remaining > 0}
      feedback={remaining > 0 ? { text: t("Podrás cambiar tu voto en {{v0}} s.", { v0: remaining }), error: false } : responseFeedback} onRespond={respond} /> : null;
  return <Screen compact footer={availabilityFooter} onRefresh={enabled ? refresh : undefined} refreshing={calls.isLoading || snapshots.isLoading || contacts.isLoading}>
    {historical ? <View style={styles.toolbar}>
      <IconButton icon="back" label={t("Volver a la convocatoria actual")} onPress={returnToCurrent} />
      <Text style={styles.date}>{t("Volver a la convocatoria actual")}</Text>
    </View> : null}
    <Heading title={historical ? t("Convocatoria histórica") : t("Convocatoria")} subtitle={activeClub?.name ?? ''}
      action={!historical && admin ? <IconButton icon="history" label={t("Historial de convocatorias")} onPress={() => router.push('/call-up-history')} /> : undefined} />
    {!historical && admin && !call && availableCalls?.length === 0 && !calls.isLoading && !snapshots.isLoading && !calls.error && !snapshots.error ? <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Crear convocatoria")} onPress={() => router.push('/create-call-up')} style={styles.create}>
        <Text style={styles.createLabel}>{t("Crear convocatoria")}</Text>
      </Pressable>
    </View> : null}
    {!historical && availableCalls && availableCalls.length > 1 ? <Options value={callId ?? ''} options={availableCalls.map(row => ({ value: row.id, label: `${formatMatchDate(row.starts_at, row.timezone)} · ${t(callUpStatusLabel(row, clock))}` }))} onChange={value => { setSelection({ scope: selectionScope, id: value }); setResponseMessage(null); setNotice(''); }} /> : null}
    {calls.isLoading || snapshots.isLoading ? <Body>{t("Cargando convocatoria…")}</Body> : null}
    {calls.error || snapshots.error ? <><Message error>{calls.error ?? snapshots.error}</Message><Button label={t("Reintentar")} onPress={refresh} /></> : null}
    {responseFeedback && (!availabilityFooter || votingClosed) ? <Message error={responseFeedback.error}>{responseFeedback.text}</Message> : null}
    {notice ? <Message>{notice}</Message> : null}
    {votingClosed && !availabilityFooter ? <Text accessibilityLiveRegion="polite" style={styles.finishedNotice}>{historical ? t("Convocatoria finalizada.") : t("Votación cerrada. La convocatoria sigue activa.")}</Text> : null}
    {call ? <>
      <Text style={styles.date}>{formatMatchDate(call.starts_at, call.timezone)} · {call.timezone} · {t(callUpStatusLabel(call, clock, historical))}</Text>
      <Body>{t('Finalización: {{v0}}', { v0: formatMatchDate(call.ends_at, call.timezone) })}</Body>
      {admin && call.evaluation_at && historical ? <Button secondary label={t("Valorar jugadores")} onPress={() => router.push({ pathname: '/call-up-ratings', params: { id: call.id } })} /> : null}
      {call.closes_at ? <Body>{t("Cierre de votación:")}{clubLocalDateTime(call.timezone, new Date(call.closes_at)).time} · {call.timezone}</Body> : null}
      {call.status !== 'cancelled' && votingDeadlinePassed(call, clock) ? <Body>{t("El plazo para votar ha terminado.")}</Body> : null}
      {call.last_notice_at ? <Body>{t("Último aviso para votar:")}{clubLocalDateTime(call.timezone, new Date(call.last_notice_at)).time} {t("· solo pendientes")}</Body> : null}
      {admin && !historical ? <CallUpAdministration key={`${scope}:${call.id}:${call.updated_at}`} call={call} onDeleted={() => handleDeleted(call.id)} onSaved={(message, reset) => { if (reset) { setLastResponse(null); setPending(null); setResponseMessage(null); } setNotice(message ?? "Convocatoria actualizada. La fotografía y respuestas se conservan."); refreshRoster(); refresh(); }} /> : null}
      {admin && contacts.error ? <Message error>{t("No se pudieron cargar los teléfonos privados. Actualiza la convocatoria antes de editarlos.")}</Message> : null}
      {snapshots.error ? <Body>{t("Respuestas no disponibles.")}</Body> : <CompactRoster key={responseScope} players={players}
        trials={snapshots.data?.trials ?? []} showTrialNotes={admin}
        trialActions={admin && !isDemo ? trial => <CallUpTrialActions key={`${trial.id}:${contacts.data?.find(contact => contact.trial_id === trial.id)?.phone ?? ''}`} trial={trial}
          phone={contacts.data?.find(contact => contact.trial_id === trial.id)?.phone ?? ''}
          editable={!historical && (call.status === 'open' || call.status === 'draft')} disabled={contacts.isLoading || Boolean(contacts.error)} onSaved={refresh} /> : undefined}
        trialEditor={!historical && admin && !isDemo && (call.status === 'open' || call.status === 'draft') ? <CallUpTrialForm key={responseScope} callUpId={call.id} onSaved={() => { refreshRoster(); refresh(); }} /> : null}
        aids={<AidsSection key={responseScope} callUpId={call.id} revision={aidsRevision} editable={!historical && admin && (call.status === 'open' || call.status === 'draft')} />} />}
      {isDemo ? <Body>{t("Convocatoria simulada · los cambios no se guardan.")}</Body> : null}
    </> : !calls.isLoading && !snapshots.isLoading && !calls.error && !snapshots.error ? <Body>{t("No hay convocatorias accesibles en este club.")}</Body> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  create: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.primary },
  createLabel: { color: colors.background, fontWeight: '700', fontSize: 13 },
  finishedNotice: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '700', padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  date: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
