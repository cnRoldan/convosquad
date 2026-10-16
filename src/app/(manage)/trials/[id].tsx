import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, DemoNotice, Field, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { listTrials, saveTrial, withdrawTrial } from '@/features/trials/service';
import type { Tables } from '@/types/database';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
export default function TrialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isDemo } = useAuth(); const { activeClub } = useClub(); const clubId = activeClub?.id;
  const load = useCallback(() => clubId ? listTrials(clubId, true) : Promise.resolve([]), [clubId]);
  const result = useResource(`trial:${session?.user.id}:${clubId}:${id}`, load, Boolean(session && clubId && id !== 'new') && !isDemo);
  if (result.isLoading) return <LoadingScreen label="Cargando prueba…" />;
  const trial = result.data?.find(row => row.id === id);
  if (id !== 'new' && (!trial || trial.status !== 'active')) return <Screen><Message error>{result.error ?? 'La prueba no está activa en este club.'}</Message><Button label="Volver a la plantilla" onPress={() => router.replace('/roster')} /></Screen>;
  return <TrialEditor key={`${session?.user.id}:${clubId}:${id}`} trial={trial ?? null} />;
}
function TrialEditor({ trial }: { trial: Tables<'club_trials'> | null }) {
  const { isDemo } = useAuth(); const { activeClub, refreshRoster } = useClub(); const clubId = activeClub?.id;
  const [name, setName] = useState(trial?.ea_id ?? '');
  const [notes, setNotes] = useState(trial?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  async function save() {
    if (!clubId || busy || isDemo) return;
    if (!name.trim() || name.trim().length > 64) return setMessage('Introduce un nombre de hasta 64 caracteres.');
    setBusy(true); setMessage('');
    try { await saveTrial(clubId, { name: name.trim(), notes: notes.trim() || null }, trial?.id); refreshRoster(); router.replace('/roster'); }
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
    <Heading title={trial ? 'Gestionar prueba' : 'Añadir prueba'} subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    <Field label="Nombre de la prueba" value={name} onChangeText={setName} maxLength={64} editable={!busy} />
    <Field label="Observaciones" value={notes} onChangeText={setNotes} maxLength={1000} multiline editable={!busy} />
    {message ? <Message error>{message}</Message> : null}
    <Button label="Guardar prueba" disabled={busy || isDemo} onPress={() => { void save(); }} />
    {trial ? <Button secondary label="Retirar de pruebas" disabled={busy || isDemo} onPress={() => setConfirming(true)} /> : null}
    <ConfirmDialog visible={confirming} title="Retirar prueba" description="Dejará de aparecer en las nuevas convocatorias. Las anteriores conservarán sus datos." busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => { void confirm(); }} />
  </Screen>;
}
