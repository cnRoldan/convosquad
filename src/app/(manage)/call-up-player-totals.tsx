import { useCallback } from 'react';
import { Body, Button, Card, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { getCallUpPlayerTotals } from '@/features/ratings/service';
import { t, useLanguage } from '@/features/i18n/runtime';
import { useResource } from '@/hooks/use-resource';

type Row = Awaited<ReturnType<typeof getCallUpPlayerTotals>>[number];
function Ranking({ title, rows, value }: { title: string; rows: Row[]; value: (row: Row) => string }) {
  return <Card title={title}>{rows.slice(0, 5).map((row, index) => <Body key={row.player_id}>{index + 1}. {row.player_name} · {value(row)}</Body>)}</Card>;
}
export default function CallUpPlayerTotalsScreen() {
  useLanguage();
  const { session, isDemo } = useAuth(); const { activeClub } = useClub(); const clubId = activeClub?.id;
  const load = useCallback(() => clubId ? getCallUpPlayerTotals(clubId) : Promise.resolve([]), [clubId]);
  const result = useResource(`call-up-totals:${session?.user.id}:${clubId}`, load, Boolean(session && clubId && !isDemo));
  const data = result.data ?? [];
  const most = [...data].sort((a, b) => b.available_count - a.available_count);
  const least = [...data].sort((a, b) => a.available_count - b.available_count || b.total_call_ups - a.total_call_ups);
  const slowest = data.filter(row => row.average_response_seconds !== null).sort((a, b) => b.average_response_seconds - a.average_response_seconds);
  const pending = [...data].sort((a, b) => b.unanswered_count - a.unanswered_count);
  return <Screen>
    <Heading title={t('Total por jugador')} subtitle={activeClub?.name ?? ''} />
    <Card title={t('⭐ Funcionalidad Prémium')}><Body>{t('Este resumen estará incluido en la futura suscripción Prémium. Puedes probarlo durante esta fase.')}</Body></Card>
    {result.isLoading ? <Body>{t('Calculando estadísticas…')}</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button label={t('Reintentar')} onPress={result.reload} /></> : null}
    {data.length ? <>
      <Ranking title={t('Mayor disponibilidad')} rows={most} value={row => t('{{v0}} disponibles de {{v1}}', { v0: row.available_count, v1: row.total_call_ups })} />
      <Ranking title={t('Menor disponibilidad')} rows={least} value={row => t('{{v0}} disponibles de {{v1}}', { v0: row.available_count, v1: row.total_call_ups })} />
      <Ranking title={t('Mayor tiempo medio para votar')} rows={slowest} value={row => t('{{v0}} min de media', { v0: Math.max(1, Math.round(row.average_response_seconds / 60)) })} />
      <Ranking title={t('Más votos pendientes')} rows={pending} value={row => t('{{v0}} sin responder', { v0: row.unanswered_count })} />
    </> : !result.isLoading && !result.error ? <Body>{t('Todavía no hay convocatorias finalizadas suficientes para calcular estadísticas.')}</Body> : null}
    <Button secondary label={t('Actualizar estadísticas')} onPress={result.reload} />
  </Screen>;
}
