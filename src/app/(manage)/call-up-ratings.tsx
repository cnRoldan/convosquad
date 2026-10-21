import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { Text, View } from 'react-native';
import { Body, Button, Card, Heading, Message, Screen } from '@/components/ui';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { getCallUp, listCallUpPlayers } from '@/features/call-ups/service';
import { ratingVisibility, ratingVisibilityMessage } from '@/features/ratings/visibility';
import { ratingDeadline, ratingWindowOpen } from '@/features/ratings/window';
import { listRatingCalls, listRatings, saveRatings, ratingError, type RatingChoice, type RatingChange } from '@/features/ratings/service';
import { t, useLanguage } from '@/features/i18n/runtime';
import { useResource } from '@/hooks/use-resource';
import { formatMatchDate } from '@/lib/format';
import { colors } from '@/theme';
import type { Tables } from '@/types/database';

export default function CallUpRatingsScreen() {
  useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isDemo } = useAuth(); const { activeClub } = useClub(); const clubId = activeClub?.id;
  const load = useCallback(async () => {
    if (!clubId || !id) return null;
    const [call, players, ratings, eligibleCalls] = await Promise.all([getCallUp(clubId, id), listCallUpPlayers(id), listRatings(id), listRatingCalls(clubId)]);
    return { call, players, ratings, eligible: eligibleCalls.some(candidate => candidate.id === id) };
  }, [clubId, id]);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const result = useResource(`ratings:${session?.user.id}:${clubId}:${id}`, load, Boolean(session && clubId && id) && !isDemo);
  if (result.isLoading) return <LoadingScreen label={t('Cargando valoraciones…')} />;
  if (!result.data || result.error) return <Screen><Message error>{result.error ?? t('No se encontró la convocatoria.')}</Message><Button label={t('Reintentar')} onPress={result.reload} /></Screen>;
  return <RatingsEditor key={`${session?.user.id}:${clubId}:${id}:${result.version}`} {...result.data} notice={savedFor === `${clubId}:${id}`} onSaved={saved => { setSavedFor(saved ? `${clubId}:${id}` : null); result.reload(); }} />;
}
function RatingsEditor({ call, players, ratings, eligible, onSaved, notice }: {
  call: Tables<'call_ups'>; players: Tables<'call_up_players'>[]; ratings: Tables<'player_ratings'>[]; eligible: boolean; onSaved: (saved?: boolean) => void; notice: boolean;
}) {
  useLanguage();
  const { activeClub } = useClub();
  const [addedPlayers, setAddedPlayers] = useState<string[]>([]);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const visiblePlayers = players.filter(player => player.availability === 'available'
    || ratings.some(rating => rating.call_up_player_id === player.id) || addedPlayers.includes(player.id));
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
    <Body>{t('Puntúa de 0 a 10. «No convocado» no cuenta como un cero ni entra en la media.')}</Body>
    <Body>{t('Se muestran los jugadores disponibles y las valoraciones guardadas. Puedes añadir a otros jugadores de la convocatoria si jugaron a última hora.')}</Body>
    {call.evaluation_at ? <Body>{t('Finalización: {{v0}}', { v0: formatMatchDate(call.ends_at, call.timezone) })}</Body> : null}
    {call.evaluation_at ? <Body>{t('Plazo para valorar: hasta {{v0}}', { v0: formatMatchDate(new Date(ratingDeadline(call)).toISOString(), call.timezone) })}</Body> : null}
    {!available ? <Message>{t('Solo puedes valorar la última convocatoria finalizada durante las 24 horas siguientes a su finalización.')}</Message> : null}
    {notice ? <Message>{t("Valoraciones guardadas.")}</Message> : null}
    {message ? <Message error>{message}</Message> : null}
    {visiblePlayers.map(player => <Card key={player.id} title={player.ea_id_snapshot}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{t('Valoración')}</Text>
        <Picker<RatingChoice> accessibilityLabel={t('Valoración de {{v0}}', { v0: player.ea_id_snapshot })} selectedValue={choices[player.id] ?? ''} enabled={Boolean(available) && !busy}
          onValueChange={value => setChoices(current => ({ ...current, [player.id]: value as RatingChoice }))}
          style={{ color: colors.text, backgroundColor: colors.surface, minHeight: 48 }}>
          <Picker.Item label={t('Sin valorar')} value="" />
          <Picker.Item label={t('No convocado')} value="not_selected" />
          {Array.from({ length: 11 }, (_, value) => <Picker.Item key={value} label={String(value)} value={String(value)} />)}
        </Picker>
      </View>
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
  </Screen>;
}
