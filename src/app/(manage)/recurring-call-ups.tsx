import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Body, Button, Card, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { intlLocale, t, useLanguage } from '@/features/i18n/runtime';
import { getRecurringCallUp, stopRecurringCallUp } from '@/features/call-ups/recurring-service';
import { weeklyDays } from '@/features/call-ups/recurrence';
import { useResource } from '@/hooks/use-resource';

export default function RecurringCallUpsScreen() {
  useLanguage();
  const { activeClub, currentMembership } = useClub();
  const { session, isDemo } = useAuth();
  const clubId = activeClub?.id;
  const admin = currentMembership?.role === 'admin';
  const load = useCallback(() => clubId ? getRecurringCallUp(clubId) : Promise.resolve(null), [clubId]);
  const schedule = useResource(`recurring:${session?.user.id}:${clubId}:${admin}`, load, Boolean(clubId && admin && !isDemo));
  const [confirmScope, setConfirmScope] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const scope = `${session?.user.id}:${clubId}:${admin}`;
  async function stop() {
    if (!clubId || !admin || isDemo || busy || confirmScope !== scope) return;
    setBusy(true); setError(false);
    try { await stopRecurringCallUp(clubId); schedule.reload(); setConfirmScope(null); }
    catch { setError(true); }
    finally { setBusy(false); }
  }
  const rule = schedule.data;
  return <Screen onRefresh={schedule.reload} refreshing={schedule.isLoading}>
    <Heading title={t('Convocatorias periódicas')} subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : !admin ? <Message>{t('Solo los capitanes pueden gestionar la repetición.')}</Message> : <>
      {schedule.isLoading ? <Body>{t('Cargando programación…')}</Body> : schedule.error ? <Message error>{t('No se pudo cargar la programación. Actualiza para reintentar.')}</Message> : rule?.enabled ? <Card title={t('Repetición semanal activa')}>
        <Body>{weeklyDays(intlLocale()).filter(day => rule.weekdays.includes(day.value)).map(day => day.name).join(' · ')}</Body>
        <Body>{t('Hora de convocatoria: {{v0}} · {{v1}}', { v0: rule.start_time.slice(0, 5), v1: rule.timezone })}</Body>
        <Body>{t('Próxima fecha programada: {{v0}}', { v0: rule.next_date })}</Body>
        <Body>{t('Cada convocatoria se prepara desde el día anterior. No se sobrescriben las convocatorias que ya existan para esa fecha.')}</Body>
        <Button secondary label={t('Detener repetición')} disabled={busy} onPress={() => setConfirmScope(scope)} />
      </Card> : !schedule.isLoading ? <>
        <Body>{t('No hay una repetición semanal activa.')}</Body>
        <Button label={t('Crear convocatoria periódica')} onPress={() => router.push('/create-call-up')} />
      </> : null}
      {rule?.last_error ? <Message error>{t('La programación necesita revisión. Comprueba la activación del club, la zona horaria y que su creador siga siendo capitán. Puedes detenerla y crear otra.')}</Message> : null}
      {error ? <Message error>{t('No se pudo detener la repetición. Inténtalo de nuevo.')}</Message> : null}
      <Button secondary label={t('Actualizar')} onPress={schedule.reload} />
    </>}
    <Button secondary label={t('Regresar')} onPress={() => router.dismissTo('/home')} />
    <ConfirmDialog visible={confirmScope === scope && admin} title={t('Detener repetición')} description={t('No se crearán más convocatorias automáticamente. Las que ya existen se conservan.')}
      busy={busy} confirmLabel={t('Detener repetición')} onCancel={() => setConfirmScope(null)} onConfirm={() => { void stop(); }} />
  </Screen>;
}
