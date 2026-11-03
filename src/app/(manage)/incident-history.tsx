import { useCallback, useState } from 'react';
import { Body, Button, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { IncidentDetails } from '@/features/incidents/components';
import { listPlayerIncidents } from '@/features/incidents/service';
import { useIncidentClock } from '@/features/incidents/use-incident-clock';
import { t, useLanguage } from '@/features/i18n/runtime';
import { useResource } from '@/hooks/use-resource';

export default function IncidentHistoryScreen() {
  const { activeClub } = useClub();
  return <IncidentHistory key={activeClub?.id} />;
}
function IncidentHistory() {
  useLanguage();
  const { session, isDemo } = useAuth();
  const { activeClub, currentMembership } = useClub();
  const [page, setPage] = useState(0);
  const clubId = activeClub?.id;
  const load = useCallback(() => clubId ? listPlayerIncidents(clubId, false, undefined, page * 100) : Promise.resolve([]), [clubId, page]);
  const enabled = Boolean(session && clubId && currentMembership?.role === 'admin' && !isDemo);
  const result = useResource(`incidents:${session?.user.id}:${clubId}:${page}`, load, enabled);
  const now = useIncidentClock(result.data ?? []);
  return <Screen>
    <Heading title={t('Histórico de incidencias')} subtitle={activeClub?.name ?? ''} />
    <Body>{t('Las incidencias dejan de marcar al jugador después de una semana, pero permanecen aquí para consulta de los capitanes.')}</Body>
    {result.isLoading ? <Body>{t('Cargando incidencias…')}</Body> : null}
    {result.error ? <Message error>{result.error}</Message> : null}
    {result.data?.map(incident => <IncidentDetails key={incident.id} incident={incident} now={now} />)}
    {result.data?.length === 0 ? <Body>{t('No hay incidencias registradas en esta página.')}</Body> : null}
    {page > 0 ? <Button secondary label="Más recientes" disabled={result.isLoading} onPress={() => setPage(current => current - 1)} /> : null}
    {result.data?.length === 100 ? <Button secondary label="Más antiguas" disabled={result.isLoading} onPress={() => setPage(current => current + 1)} /> : null}
    <Button secondary label="Actualizar incidencias" disabled={!enabled || result.isLoading} onPress={result.reload} />
  </Screen>;
}
