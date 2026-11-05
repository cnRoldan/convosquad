import { useCallback, useState } from 'react';
import { Body, Button, Card, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { deleteTrialHistory, listTrialHistory } from '@/features/trials/service';
import { t, useLanguage, intlLocale } from '@/features/i18n/runtime';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';

export default function TrialHistoryScreen() {
  useLanguage();
  const { session, isDemo } = useAuth(); const { activeClub } = useClub(); const clubId = activeClub?.id;
  const [page, setPage] = useState(0);
  const load = useCallback(() => clubId ? listTrialHistory(clubId, page * 100) : Promise.resolve(null), [clubId, page]);
  const result = useResource(`trial-history:${session?.user.id}:${clubId}:${page}`, load, Boolean(session && clubId && !isDemo));
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function remove() {
    if (!pending || busy) return;
    setBusy(true); setError('');
    try { await deleteTrialHistory(pending.id); setPending(null); result.reload(); }
    catch (cause) { setError(backendErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading title={t('Historial de pruebas')} subtitle={activeClub?.name ?? ''} />
    {result.data ? <Card title={t(result.data.premium ? 'Historial Prémium: {{v0}} pruebas' : 'Historial gratuito: {{v0}}/6', { v0: result.data.total })}>
      <Body>{t(result.data.premium ? 'Con Prémium puedes conservar más de 6 pruebas retiradas o incorporadas durante 12 meses.' : 'El historial gratuito conserva hasta 6 pruebas retiradas o incorporadas durante 12 meses.')}</Body>
    </Card> : null}
    {result.isLoading ? <Body>{t('Cargando historial de pruebas…')}</Body> : null}
    {result.error || error ? <Message error>{result.error ?? error}</Message> : null}
    {result.data?.entries.map(trial => <Card key={trial.id} title={trial.ea_id}>
      <Body>{trial.status === 'incorporated' ? t('Incorporado a la plantilla') : t('Retirado de pruebas')} · {new Date(trial.resolved_at ?? trial.created_at).toLocaleDateString(intlLocale(), { timeZone: activeClub?.timezone ?? 'Europe/Madrid' })}</Body>
      {trial.position ? <Body>{t('Posición: {{v0}}', { v0: trial.position })}</Body> : null}
      {trial.notes ? <Body>{trial.notes}</Body> : null}
      <Button secondary label={t('Eliminar del historial')} onPress={() => setPending({ id: trial.id, name: trial.ea_id })} />
    </Card>)}
    {!result.isLoading && !result.error && !result.data?.entries.length ? <Body>{t('Todavía no hay pruebas archivadas.')}</Body> : null}
    {page > 0 ? <Button secondary label={t('Más recientes')} disabled={result.isLoading} onPress={() => setPage(current => current - 1)} /> : null}
    {result.data?.hasMore ? <Button secondary label={t('Más antiguas')} disabled={result.isLoading} onPress={() => setPage(current => current + 1)} /> : null}
    <ConfirmDialog visible={Boolean(pending)} title={t('Eliminar del historial')} description={t('¿Quieres borrar del historial la prueba de {{v0}}?', { v0: pending?.name ?? '' })} confirmLabel={t('Eliminar')} busy={busy} onCancel={() => setPending(null)} onConfirm={() => { void remove(); }} />
  </Screen>;
}
