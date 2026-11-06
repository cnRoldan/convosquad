import { intlLocale, t, useLanguage } from '@/features/i18n/runtime';
import { useCallback } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { listCallUpHistory } from '@/features/call-ups/service';
import { callUpStatusLabel } from '@/features/call-ups/lifecycle';
import { CallUpStatusLabel } from '@/features/call-ups/status-label';
import { useCallUpSync } from '@/features/call-ups/use-call-up-sync';
import { useResource } from '@/hooks/use-resource';
import { formatMatchDate } from '@/lib/format';
export default function CallUpHistoryScreen() {
  useLanguage();
  const { activeClub, currentMembership, rosterVersion } = useClub(); const { session, isDemo } = useAuth();
  const clubId = activeClub?.id; const enabled = Boolean(session && clubId && currentMembership?.role === 'admin' && !isDemo);
  const scope = `history:${session?.user.id}:${clubId}:${rosterVersion}`;
  const load = useCallback(() => clubId ? listCallUpHistory(clubId) : Promise.resolve([]), [clubId]);
  const result = useResource(scope, load, enabled);
  useCallUpSync(scope, clubId, enabled, result.reload);
  return <Screen>
    <Heading title={t("Historial de convocatorias")} subtitle={activeClub?.name ?? ''} />
    <Body>{t("Las diez convocatorias de días anteriores más recientes, según la zona horaria del club. Solo capitanes.")}</Body>
    <Card>
      <Body>{t('Compara la disponibilidad, el tiempo de respuesta y las suplencias de cada jugador.')}</Body>
      <Button label={t('Total por jugador')} onPress={() => router.push('/call-up-player-totals')} />
    </Card>
    {isDemo ? <DemoNotice /> : null}
    {result.isLoading ? <Body>{t("Cargando historial…")}</Body> : null}
    {result.error ? <Message error>{result.error}</Message> : null}
    {result.data?.map(call => <Card key={call.id} title={formatMatchDate(call.starts_at, call.timezone)}>
      <Body><CallUpStatusLabel label={callUpStatusLabel(call, undefined, true)} /></Body>
      {call.average_score !== null ? <Body>{t('Valoración media del equipo: {{v0}} / 10', { v0: new Intl.NumberFormat(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(call.average_score) })}</Body> : null}
      <Button secondary label={t("Consultar convocatoria del {{v0}}", { v0: call.local_date })} onPress={() => router.push({ pathname: '/historical-call-up', params: { id: call.id } })} />
      <Button secondary label="Consultar alineación" onPress={() => router.push({ pathname: '/lineup-history', params: { id: call.id } })} />
    </Card>)}
    {result.data?.length === 0 ? <Body>{t("No hay convocatorias de días anteriores.")}</Body> : null}
    {!isDemo ? <Button secondary label={t("Actualizar historial")} disabled={result.isLoading} onPress={result.reload} /> : <Body>{t("El historial real requiere una cuenta de capitán.")}</Body>}
  </Screen>;
}
