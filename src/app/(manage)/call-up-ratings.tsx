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
import { ratingCutoff } from '@/features/ratings/window';
import { listRatings, saveRatings, ratingError, type RatingChoice, type RatingChange } from '@/features/ratings/service';
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
    const [call, players, ratings] = await Promise.all([getCallUp(clubId, id), listCallUpPlayers(id), listRatings(id)]);
    return { call, players, ratings };
  }, [clubId, id]);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  const result = useResource(`ratings:${session?.user.id}:${clubId}:${id}`, load, Boolean(session && clubId && id) && !isDemo);
  if (result.isLoading) return <LoadingScreen label={t('Cargando valoraciones…')} />;
  if (!result.data || result.error) return <Screen><Message error>{result.error ?? t('No se encontró la convocatoria.')}</Message><Button label={t('Reintentar')} onPress={result.reload} /></Screen>;
  return <RatingsEditor key={`${session?.user.id}:${clubId}:${id}:${result.version}`} {...result.data} notice={savedFor === `${clubId}:${id}`} onSaved={saved => { setSavedFor(saved ? `${clubId}:${id}` : null); result.reload(); }} />;
}
function RatingsEditor({ call, players, ratings, onSaved, notice }: {
  call: Tables<'call_ups'>; players: Tables<'call_up_players'>[]; ratings: Tables<'player_ratings'>[]; onSaved: (saved?: boolean) => void; notice: boolean;
}) {
  useLanguage();
  const { activeClub } = useClub();
  const [choices, setChoices] = useState<Record<string, RatingChoice>>(() => Object.fromEntries(players.map(player => {
    const saved = ratings.find(rating => rating.call_up_player_id === player.id);
    return [player.id, saved?.not_selected ? 'not_selected' : saved?.score !== null && saved?.score !== undefined ? String(saved.score) as RatingChoice : ''];
  })));
  const [clock, setClock] = useState(Date.now); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const available = call.evaluation_at && Date.parse(call.evaluation_at) <= clock && Date.parse(call.starts_at) <= clock
    && Date.parse(call.starts_at) >= ratingCutoff(clock) && (call.status === 'closed' || call.status === 'open');
  const changes: RatingChange[] = players.flatMap(player => {
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
    {call.evaluation_at ? <Body>{t('Hora de valoración: {{v0}}', { v0: formatMatchDate(call.evaluation_at, call.timezone) })}</Body> : null}
    {!available ? <Message>{t('Las valoraciones se habilitan a la hora programada y se conservan durante tres meses.')}</Message> : null}
    {notice ? <Message>{t("Valoraciones guardadas.")}</Message> : null}
    {message ? <Message error>{message}</Message> : null}
    {players.map(player => <Card key={player.id} title={player.ea_id_snapshot}>
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
    {!players.length ? <Body>{t('No hay jugadores que valorar.')}</Body> : null}
    <Button label={t('Guardar valoraciones')} disabled={busy || !available || !changes.length} onPress={() => { void save(); }} />
    <Button secondary label={t('Recargar valoraciones')} disabled={busy} onPress={() => onSaved(false)} />
    <Button secondary label={t('Ver rendimiento del club')} onPress={() => router.replace('/performance')} />
  </Screen>;
}
