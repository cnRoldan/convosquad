import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, DemoNotice, Field, Heading, Message, Options, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { listPlayers } from '@/features/players/service';
import { categories, categoryLabels, isCategory } from '@/features/players/categories';
import { listTrials, saveTrial, withdrawTrial, promoteTrial } from '@/features/trials/service';
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
  const { session, isDemo } = useAuth(); const { activeClub, refreshRoster } = useClub(); const clubId = activeClub?.id;
  const [name, setName] = useState(trial?.ea_id ?? ''); const [jersey, setJersey] = useState(trial?.jersey_number?.toString() ?? '');
  const [position, setPosition] = useState(trial?.position ?? ''); const [notes, setNotes] = useState(trial?.notes ?? '');
  const [category, setCategory] = useState(''); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''); const [action, setAction] = useState<'withdraw' | 'promote' | null>(null);
  const load = useCallback(() => clubId ? listPlayers(clubId, true) : Promise.resolve([]), [clubId]);
  const players = useResource(`trial-players:${session?.user.id}:${clubId}`, load, Boolean(session && trial && clubId) && !isDemo);
  const matching = players.data?.find(player => player.ea_id.trim().toLowerCase() === trial?.ea_id.trim().toLowerCase());
  const dirty = trial && (name.trim() !== trial.ea_id || jersey.trim() !== (trial.jersey_number?.toString() ?? '') || position.trim() !== (trial.position ?? '') || notes.trim() !== (trial.notes ?? ''));
  async function save() {
    if (!clubId || busy || isDemo) return;
    if (!name.trim() || name.trim().length > 64) return setMessage('Introduce un nombre o EA ID de hasta 64 caracteres.');
    if (jersey.trim() && (!/^\d{1,2}$/.test(jersey.trim()) || Number(jersey) < 1 || Number(jersey) > 99)) return setMessage('El dorsal debe estar entre 1 y 99 o quedar vacío.');
    setBusy(true); setMessage('');
    try { await saveTrial(clubId, { ea_id: name.trim(), jersey_number: jersey.trim() ? Number(jersey) : null, position: position.trim() || null, notes: notes.trim() || null }, trial?.id); refreshRoster(); router.replace('/roster'); }
    catch (error) { setMessage(backendErrorMessage(error)); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!trial || busy || isDemo || !action) return;
    setBusy(true); setMessage('');
    try {
      if (action === 'withdraw') await withdrawTrial(trial.id); else {
        if (!isCategory(category)) return setMessage('Selecciona la categoría definitiva.');
        await promoteTrial(trial.id, category, matching?.id);
      }
      refreshRoster(); router.replace('/roster');
    } catch (error) { setMessage(backendErrorMessage(error)); players.reload(); }
    finally { setBusy(false); setAction(null); }
  }
  return <Screen>
    <Heading title={trial ? 'Gestionar prueba' : 'Añadir jugador a prueba'} subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    <Field label="Nombre o EA ID" value={name} onChangeText={setName} maxLength={64} editable={!busy} />
    <Field label="Dorsal (opcional)" value={jersey} onChangeText={setJersey} keyboardType="number-pad" maxLength={2} editable={!busy} />
    <Field label="Posición indicada (texto libre)" value={position} onChangeText={setPosition} maxLength={80} editable={!busy} />
    <Field label="Observaciones" value={notes} onChangeText={setNotes} maxLength={1000} multiline editable={!busy} />
    {message ? <Message error>{message}</Message> : null}
    <Button label="Guardar prueba" disabled={busy || isDemo} onPress={() => { void save(); }} />
    {trial ? <>
      <Button secondary label="Retirar de pruebas" disabled={busy || isDemo} onPress={() => setAction('withdraw')} />
      <Card title="Incorporar a la plantilla">
        <Body>Selecciona la categoría definitiva antes de incorporar.</Body>
        <Options value={category} options={categories.map(value => ({ value, label: categoryLabels[value] }))} onChange={setCategory} disabled={busy} />
        {dirty ? <Body>Guarda los cambios antes de incorporar esta prueba.</Body> : null}
        {players.error ? <><Message error>{players.error}</Message><Button label="Reintentar" onPress={players.reload} /></> : null}
        <Body>{matching ? `Se utilizará la ficha existente ${matching.ea_id}, conservando su cuenta si está vinculada.` : 'Se creará una ficha oficial sin cuenta. La prueba y sus observaciones se conservarán.'}</Body>
        <Button label={matching ? 'Incorporar con ficha existente' : 'Incorporar como jugador sin registrar'} disabled={busy || isDemo || Boolean(dirty) || !isCategory(category) || players.isLoading || Boolean(players.error)} onPress={() => setAction('promote')} />
      </Card>
    </> : null}
    <ConfirmDialog visible={Boolean(action)} title={action === 'withdraw' ? 'Retirar prueba' : 'Incorporar a la plantilla'} description={action === 'withdraw' ? 'Se conserva la ficha retirada y sus copias históricas.' : `${name} pasará a ${isCategory(category) ? categoryLabels[category] : 'la categoría elegida'}. Las convocatorias anteriores no cambiarán y no se creará una cuenta de usuario.`} busy={busy} onCancel={() => setAction(null)} onConfirm={() => { void confirm(); }} />
  </Screen>;
}
