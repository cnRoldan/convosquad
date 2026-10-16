import { t, useLanguage } from '@/features/i18n/runtime';
import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, DemoNotice, Field, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { listTrials, listTrialContacts, saveTrial, withdrawTrial } from '@/features/trials/service';
import { PrivatePhoneField } from '@/features/call-ups/private-phone-field';
import { normalizePhone } from '@/features/call-ups/phone';
import type { Tables } from '@/types/database';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
export default function TrialScreen() {
  useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isDemo } = useAuth(); const { activeClub } = useClub(); const clubId = activeClub?.id;
  const load = useCallback(async () => {
    if (!clubId) return { trials: [], contacts: [] };
    const [trials, contacts] = await Promise.all([listTrials(clubId, true), listTrialContacts(clubId)]);
    return { trials, contacts };
  }, [clubId]);
  const result = useResource(`trial:${session?.user.id}:${clubId}:${id}`, load, Boolean(session && clubId && id !== 'new') && !isDemo);
  if (result.isLoading) return <LoadingScreen label={t("Cargando prueba…")} />;
  const trial = result.data?.trials.find(row => row.id === id);
  if (id !== 'new' && (!trial || trial.status !== 'active')) return <Screen><Message error>{result.error ?? t("La prueba no está activa en este club.")}</Message><Button label={t("Volver a la plantilla")} onPress={() => router.replace('/roster')} /></Screen>;
  return <TrialEditor key={`${session?.user.id}:${clubId}:${id}`} trial={trial ?? null} initialPhone={result.data?.contacts.find(row => row.trial_id === id)?.phone ?? ''} />;
}
function TrialEditor({ trial, initialPhone }: { trial: Tables<'club_trials'> | null; initialPhone: string }) {
  useLanguage();
  const { isDemo } = useAuth(); const { activeClub, refreshRoster } = useClub(); const clubId = activeClub?.id;
  const [name, setName] = useState(trial?.ea_id ?? '');
  const [phone, setPhone] = useState(initialPhone);
  const [notes, setNotes] = useState(trial?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  async function save() {
    if (!clubId || busy || isDemo) return;
    if (!name.trim() || name.trim().length > 64) return setMessage(t("Introduce un nombre de hasta 64 caracteres."));
    let normalizedPhone: string | null;
    try { normalizedPhone = normalizePhone(phone); }
    catch (error) { return setMessage(error instanceof Error ? error.message : backendErrorMessage(error)); }
    setBusy(true); setMessage('');
    try { await saveTrial(clubId, { name: name.trim(), notes: notes.trim() || null, phone: normalizedPhone }, trial?.id); refreshRoster(); router.replace('/roster'); }
    catch (error) { setMessage(backendErrorMessage(error)); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!trial || busy || isDemo) return;
    setBusy(true); setMessage('');
    try { await withdrawTrial(trial.id); refreshRoster(); router.replace('/roster'); }
    catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); setConfirming(false); }
  }
  return <Screen>
    <Heading title={trial ? t("Gestionar prueba") : t("Añadir prueba")} subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    <Field label={t("Nombre de la prueba")} value={name} onChangeText={setName} maxLength={64} editable={!busy} />
    <PrivatePhoneField label={t("Teléfono de la prueba (solo capitanes, opcional)")} value={phone} onChangeText={setPhone} editable={!busy} />
    <Field label={t("Observaciones")} value={notes} onChangeText={setNotes} maxLength={1000} multiline editable={!busy} />
    {message ? <Message error>{message}</Message> : null}
    <Button label={t("Guardar prueba")} disabled={busy || isDemo} onPress={() => { void save(); }} />
    {trial ? <Button secondary label={t("Retirar de pruebas")} disabled={busy || isDemo} onPress={() => setConfirming(true)} /> : null}
    <ConfirmDialog visible={confirming} title={t("Retirar prueba")} description={t("Dejará de aparecer en las nuevas convocatorias. Las anteriores conservarán sus datos.")} busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => { void confirm(); }} />
  </Screen>;
}
