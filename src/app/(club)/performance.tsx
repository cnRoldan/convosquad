import { useCallback, useState } from 'react';
import { RatingVisibilitySettings } from '@/features/ratings/visibility-settings';
import { ratingVisibility, ratingVisibilityMessage } from '@/features/ratings/visibility';
import { Redirect, router } from 'expo-router';
import { Body, Button, Card, Heading, Message, Options, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { getPerformance, getRatingHistory, listRatingCalls } from '@/features/ratings/service';
import { t, useLanguage, intlLocale } from '@/features/i18n/runtime';
import { useResource } from '@/hooks/use-resource';
import { formatMatchDate } from '@/lib/format';

export default function PlayerRatingsScreen() {
  useLanguage();
  const { session, isDemo } = useAuth(); const { activeClub, currentMembership } = useClub(); const clubId = activeClub?.id;
  const admin = currentMembership?.role === 'admin';
  const visibility = ratingVisibility(activeClub?.ratingsVisibility);
  const readable = admin || visibility !== 'captains';
  const [period, setPeriod] = useState<'7d' | '1m' | '3m'>('3m');
  const [selected, setSelected] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!clubId) return null;
    const [performance, calls] = await Promise.all([getPerformance(clubId, period), admin ? listRatingCalls(clubId) : Promise.resolve([])]);
    return { performance, calls };
  }, [clubId, period, admin]);
  const result = useResource(`performance:${session?.user.id}:${clubId}:${visibility}:${admin}:${period}`, load, Boolean(session && clubId && readable) && !isDemo);
  const loadHistory = useCallback(() => clubId && selected ? getRatingHistory(clubId, selected) : Promise.resolve([]), [clubId, selected]);
  const history = useResource(`rating-history:${session?.user.id}:${clubId}:${visibility}:${admin}:${selected}`, loadHistory, Boolean(session && clubId && selected && readable) && !isDemo);
  if (!readable) return <Redirect href="/home" />;
  return <Screen>
    <Heading title={t('Valoraciones y rendimiento')} subtitle={activeClub?.name ?? ''} />
    <Body>{t(ratingVisibilityMessage(visibility))}</Body>
    {admin ? <RatingVisibilitySettings /> : null}
    <Body>{t('Histórico de los últimos tres meses. Las convocatorias sin valorar y «No convocado» quedan fuera de la media.')}</Body>
    <Options value={period} options={[{ value: '7d', label: t('Últimos 7 días') }, { value: '1m', label: t('Último mes') }, { value: '3m', label: t('Últimos 3 meses') }]}
      onChange={value => { setPeriod(value); setSelected(null); }} />
    {result.isLoading ? <Body>{t('Cargando valoraciones…')}</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button label={t('Reintentar')} onPress={result.reload} /></> : null}
    {result.data?.performance.map(player => <Card key={player.player_id} title={player.player_name}>
      <Body>{player.average_score === null ? t('Sin media') : t('Media: {{v0}} / 10', { v0: Number(player.average_score).toLocaleString(intlLocale(), { maximumFractionDigits: 2 }) })}</Body>
      <Body>{t('{{v0}} valoraciones · {{v1}} veces no convocado', { v0: player.rated_matches, v1: player.not_selected_matches })}</Body>
      <Button secondary label={selected === player.player_id ? t('Ocultar historial de {{v0}}', { v0: player.player_name }) : t('Ver historial de {{v0}}', { v0: player.player_name })} onPress={() => setSelected(current => current === player.player_id ? null : player.player_id)} />
      {selected === player.player_id ? <>
        {history.isLoading ? <Body>{t('Cargando valoraciones…')}</Body> : null}
        {history.error ? <><Message error>{history.error}</Message><Button label={t('Reintentar')} onPress={history.reload} /></> : null}
        {history.data?.map(match => <Body key={match.call_up_id}>{formatMatchDate(match.starts_at, match.timezone)} · {match.not_selected ? t('No convocado') : `${match.score} / 10`}</Body>)}
      </> : null}
    </Card>)}
    {!result.isLoading && !result.error && !result.data?.performance.length ? <Body>{t('Todavía no hay valoraciones en este período.')}</Body> : null}
    {admin ? <Card title={t('Convocatorias para valorar')}>
      {result.data?.calls.map(call => <Button key={call.id} secondary label={t('Valorar convocatoria del {{v0}}', { v0: formatMatchDate(call.starts_at, call.timezone) })}
        onPress={() => router.push({ pathname: '/call-up-ratings', params: { id: call.id } })} />)}
      {!result.isLoading && !result.data?.calls.length ? <Body>{t('Programa una hora de valoración al crear o editar una convocatoria.')}</Body> : null}
    </Card> : null}
    <Button secondary label={t('Volver al club')} onPress={() => router.navigate('/home')} />
    <Button secondary label={t('Actualizar rendimiento')} onPress={() => { result.reload(); history.reload(); }} />
  </Screen>;
}
