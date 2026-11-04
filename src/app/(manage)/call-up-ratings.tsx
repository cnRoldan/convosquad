import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { Text, View } from 'react-native';
import { Body, Button, Card, Heading, Message, Screen } from '@/components/ui';
import { RatingSelector } from '@/features/ratings/rating-selector';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { getCallUp, listCallUpPlayers } from '@/features/call-ups/service';
import { ratingVisibility, ratingVisibilityMessage } from '@/features/ratings/visibility';
import { ratingDeadline, ratingWindowOpen } from '@/features/ratings/window';
import { listRatingCalls, listRatings, saveRatings, ratingError, readRatingLineup, type RatingLineup, type RatingChoice, type RatingChange } from '@/features/ratings/service';
import { t, useLanguage } from '@/features/i18n/runtime';
import { useResource } from '@/hooks/use-resource';
import { formatMatchDate } from '@/lib/format';
import { colors } from '@/theme';
import { listPlayerIncidents, type PlayerIncident } from '@/features/incidents/service';
import { incidentLabel } from '@/features/incidents/model';
import { RecordIncidentModal } from '@/features/incidents/components';
import type { Tables } from '@/types/database';

export default function CallUpRatingsScreen() {
  useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isDemo } = useAuth(); const { activeClub } = useClub(); const clubId = activeClub?.id;
  const load = useCallback(async () => {
    if (!clubId || !id) return null;
    const [call, players, ratings, eligibleCalls, incidents, lineup] = await Promise.all([getCallUp(clubId, id), listCallUpPlayers(id), listRatings(id), listRatingCalls(clubId), listPlayerIncidents(clubId, false, id), readRatingLineup(id)]);
    return { call, players, ratings, incidents, lineup, eligible: eligibleCalls.some(candidate => candidate.id === id) };
  }, [clubId, id]);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const result = useResource(`ratings:${session?.user.id}:${clubId}:${id}`, load, Boolean(session && clubId && id) && !isDemo);
  if (result.isLoading) return <LoadingScreen label={t('Cargando valoraciones…')} />;
  if (!result.data || result.error) return <Screen><Message error>{result.error ?? t('No se encontró la convocatoria.')}</Message><Button label={t('Reintentar')} onPress={result.reload} /></Screen>;
  return <RatingsEditor key={`${session?.user.id}:${clubId}:${id}:${result.version}`} {...result.data} notice={savedFor === `${clubId}:${id}`} onSaved={saved => { setSavedFor(saved ? `${clubId}:${id}` : null); result.reload(); }} />;
}
function RatingsEditor({ call, players, ratings, incidents: initialIncidents, lineup, eligible, onSaved, notice }: {
  call: Tables<'call_ups'>; players: Tables<'call_up_players'>[]; ratings: Tables<'player_ratings'>[]; incidents: PlayerIncident[]; lineup: RatingLineup; eligible: boolean; onSaved: (saved?: boolean) => void; notice: boolean;
}) {
  useLanguage();
  const { activeClub } = useClub();
  const [incidents, setIncidents] = useState(initialIncidents);
  const [incidentEntry, setIncidentEntry] = useState<Tables<'call_up_players'> | null>(null);
  const [incidentSaved, setIncidentSaved] = useState(false);
  const [addedPlayers, setAddedPlayers] = useState<string[]>([]);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const visiblePlayers = players.filter(player => lineup.entryIds.includes(player.id) || addedPlayers.includes(player.id));
  const savedOutsideLineup = players.some(player => !visiblePlayers.includes(player) && (ratings.some(rating => rating.call_up_player_id === player.id) || incidents.some(incident => incident.call_up_player_id === player.id)));
  const remainingPlayers = players.filter(player => !visiblePlayers.includes(player));
  const [choices, setChoices] = useState<Record<string, RatingChoice>>(() => Object.fromEntries(players.map(player => {
    const saved = ratings.find(rating => rating.call_up_player_id === player.id);
    return [player.id, saved?.not_selected ? 'not_selected' : saved?.score !== null && saved?.score !== undefined ? String(saved.score) as RatingChoice : ''];
  })));
  const [clock, setClock] = useState(Date.now); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const available = eligible && ratingWindowOpen(call, clock);
  const changes: RatingChange[] = visiblePlayers.flatMap(player => {
    const previous = ratings.find(rating => rating.call_up_player_id === player.id);
    const before = previous?.not_selected ? 'not_selected' : previous?.score !== null && previous?.score !== undefined ? String(previous.score) : '';
    const next = choices[player.id] ?? '';
    if (before === next) return [];
    return [{ entry_id: player.id, expected_updated_at: previous?.updated_at ?? null,
      ...(next === '' ? { clear: true } : next === 'not_selected' ? { not_selected: true } : { score: Number(next) }) }];
  });
  async function save() {
    if (busy || !available || !changes.length) return;
    setBusy(true); setMessage('');
    try { await saveRatings(call.id, changes); onSaved(true); }
    catch (error) { setMessage(ratingError(error)); }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading title={t('Valorar jugadores')} subtitle={formatMatchDate(call.starts_at, call.timezone)} />
    <Body>{t(ratingVisibilityMessage(ratingVisibility(activeClub?.ratingsVisibility)))}</Body>
    <Body>{t('Puntúa de 0 a 10. La papelera marca «No alineado»: no cuenta como un cero ni entra en la media.')}</Body>
    <Body>{t('Se muestran los titulares del once publicado, independientemente de su voto. Puedes añadir a otros jugadores de la convocatoria si participaron a última hora.')}</Body>
    {!lineup.published ? <Message>{t('No se publicó un once para esta convocatoria. Añade manualmente a los jugadores que participaron para valorarlos.')}</Message> : null}
    {savedOutsideLineup ? <Message>{t('Hay valoraciones o incidencias guardadas de jugadores fuera del once. Puedes consultarlas añadiendo al jugador a la valoración.')}</Message> : null}
    {call.evaluation_at ? <Body>{t('Finalización: {{v0}}', { v0: formatMatchDate(call.ends_at, call.timezone) })}</Body> : null}
    {call.evaluation_at ? <Body>{t('Plazo para valorar: hasta {{v0}}', { v0: formatMatchDate(new Date(ratingDeadline(call)).toISOString(), call.timezone) })}</Body> : null}
    {!available ? <Message>{t('Solo puedes valorar la última convocatoria finalizada durante las 24 horas siguientes a su finalización.')}</Message> : null}
    {notice ? <Message>{t("Valoraciones guardadas.")}</Message> : null}
    {incidentSaved ? <Message>{t('Incidencia registrada. La marca estará vigente durante una semana.')}</Message> : null}
    {message ? <Message error>{message}</Message> : null}
    {visiblePlayers.map(player => <Card key={player.id} title={player.ea_id_snapshot}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{t('Valoración')}</Text>
        <RatingSelector playerName={player.ea_id_snapshot} value={choices[player.id] ?? ''} disabled={!available || busy}
          onChange={value => setChoices(current => ({ ...current, [player.id]: value }))} />
      </View>
      {incidents.filter(incident => incident.call_up_player_id === player.id).map(incident => <Body key={incident.id}>{t(incidentLabel(incident.kind))}{incident.note ? ` · ${incident.note}` : ''}</Body>)}
      <Button secondary label={t('Registrar incidencia')} disabled={!available || busy || !player.source_player_id} onPress={() => { setIncidentSaved(false); setIncidentEntry(player); }} />
    </Card>)}
    {!visiblePlayers.length ? <Body>{t('No hay jugadores que valorar.')}</Body> : null}
    {remainingPlayers.length ? addingPlayer ? <Card title={t('Añadir jugador a la valoración')}>
      <Body>{t('Elige a un jugador que participó a última hora. Su voto no se modificará.')}</Body>
      <Picker<string> accessibilityLabel={t('Jugador que añadir a la valoración')} selectedValue={selectedPlayer}
        enabled={Boolean(available) && !busy} onValueChange={setSelectedPlayer}
        style={{ color: colors.text, backgroundColor: colors.surface, minHeight: 48 }}>
        <Picker.Item label={t('Selecciona un jugador')} value="" />
        {remainingPlayers.map(player => <Picker.Item key={player.id} label={player.ea_id_snapshot} value={player.id} />)}
      </Picker>
      <Button label={t('Añadir a la valoración')} disabled={!available || busy || !remainingPlayers.some(player => player.id === selectedPlayer)} onPress={() => {
        setAddedPlayers(current => [...current, selectedPlayer]); setSelectedPlayer(''); setAddingPlayer(false);
      }} />
      <Button secondary label={t('Cancelar')} disabled={busy} onPress={() => { setAddingPlayer(false); setSelectedPlayer(''); }} />
    </Card> : <Button secondary label={t('Añadir jugador a la valoración')} disabled={!available || busy} onPress={() => setAddingPlayer(true)} /> : null}
    <Button label={t('Guardar valoraciones')} disabled={busy || !available || !changes.length} onPress={() => { void save(); }} />
    <Button secondary label={t('Recargar valoraciones')} disabled={busy} onPress={() => onSaved(false)} />
    <Button secondary label={t('Ver rendimiento del club')} onPress={() => router.replace('/performance')} />
    <Button secondary label={t('Histórico de incidencias')} onPress={() => router.push('/incident-history')} />
    {incidentEntry ? <RecordIncidentModal key={incidentEntry.id} callId={call.id} entryId={incidentEntry.id} playerName={incidentEntry.ea_id_snapshot} close={() => setIncidentEntry(null)} saved={incident => {
      setIncidents(current => [incident, ...current]); setIncidentEntry(null); setIncidentSaved(true);
    }} /> : null}
  </Screen>;
}
