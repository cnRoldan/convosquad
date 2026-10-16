import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Switch } from 'react-native';
import { Body, Button, Card, DemoNotice, Field, Heading, Message, Options, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { importRoster, listPlayers } from '@/features/players/service';
import { listTrials } from '@/features/trials/service';
import { categories, categoryLabels } from '@/features/players/categories';
import { parseRosterText, validateImportRows } from '@/features/players/import-parser';
import type { ImportRow } from '@/features/players/import-parser';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
export default function RosterImportScreen() {
  const { session, isDemo } = useAuth(); const { activeClub } = useClub();
  return <RosterImportEditor key={`${session?.user.id}:${activeClub?.id}:${isDemo}`} />;
}
function RosterImportEditor() {
  const { session, isDemo } = useAuth(); const { activeClub, roster, refreshRoster, notifyClub } = useClub(); const clubId = activeClub?.id;
  const [text, setText] = useState(''); const [rows, setRows] = useState<ImportRow[] | null>(null); const [metadata, setMetadata] = useState<string[]>([]);
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [confirming, setConfirming] = useState(false);
  const load = useCallback(async () => {
    if (!clubId) return { players: [], trials: [] };
    const [players, trials] = await Promise.all([listPlayers(clubId, true), listTrials(clubId)]); return { players, trials };
  }, [clubId]);
  const existing = useResource(`import-existing:${session?.user.id}:${clubId}`, load, Boolean(session && clubId) && !isDemo);
  const current = useMemo(() => isDemo ? roster : existing.data?.players.map(player => ({ eaId: player.ea_id, jerseyNumber: player.jersey_number })) ?? [], [isDemo, roster, existing.data]);
  const checked = useMemo(() => validateImportRows(rows ?? [], current, existing.data?.trials.map(trial => ({ eaId: trial.ea_id })) ?? []), [rows, current, existing.data]);
  const selected = checked.filter(entry => entry.row.selected && entry.row.kind !== 'aid'); const invalid = selected.filter(entry => entry.errors.length);
  const players = selected.flatMap(entry => entry.player ? [entry.player] : []); const trials = selected.flatMap(entry => entry.trial ? [entry.trial] : []);
  function preview() { const parsed = parseRosterText(text); setRows(parsed.error ? null : parsed.rows); setMetadata(parsed.metadata); setMessage(parsed.error ?? 'Revisa todas las entradas antes de importar.'); }
  function edit(id: string, change: Partial<ImportRow>) { setRows(current => current?.map(row => row.id === id ? { ...row, ...change } : row) ?? null); }
  async function submit() {
    if (!clubId || isDemo || busy || invalid.length || !(players.length + trials.length) || existing.isLoading || existing.error) return;
    setBusy(true); setMessage('');
    try {
      const saved = await importRoster(clubId, players, trials);
      if (saved.players !== players.length || saved.trials !== trials.length) throw new Error('Resultado incompleto.');
      setRows(null); setText(''); setConfirming(false); refreshRoster();
      notifyClub(clubId, `Importados ${saved.players} jugadores y ${saved.trials} pruebas.`); router.replace('/roster');
    } catch (error) { setMessage(backendErrorMessage(error)); existing.reload(); setConfirming(false); } finally { setBusy(false); }
  }
  return <Screen>
    <Heading title="Importar desde WhatsApp" subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    <Body>Se reconocen categorías, dorsales con emojis, PRUEBAS y AYUDAS. La plantilla existente se conserva. Las respuestas de convocatorias nunca se importan.</Body>
    <Field label="Plantilla de WhatsApp" multiline value={text} onChangeText={value => { setText(value); setRows(null); }} editable={!busy} textAlignVertical="top" style={{ minHeight: 180 }} placeholder={'🧤 PORTEROS\n2️⃣3️⃣alexinstic23 ✅\nPRUEBAS\nTrialPlayer (DFC)'} />
    <Button label="Analizar plantilla" disabled={busy || existing.isLoading} onPress={preview} />
    {existing.isLoading ? <Body>Comprobando plantilla y pruebas…</Body> : null}
    {existing.error ? <><Message error>{existing.error}</Message><Button label="Reintentar" onPress={existing.reload} /></> : null}
    {message ? <Message>{message}</Message> : null}
    {metadata.length ? <Card title="Cabecera informativa"><Body>{metadata.join(' · ')}</Body><Body>No cambia la fecha ni los datos de una convocatoria.</Body></Card> : null}
    {rows ? <>
      <Card title="Vista previa"><Body>{players.length} jugadores válidos · {trials.length} pruebas válidas · {invalid.length} entradas con errores</Body>
        {invalid.length ? <Button secondary label="Excluir entradas con errores" disabled={busy} onPress={() => setRows(current => current?.map(row => checked.find(entry => entry.row.id === row.id)?.errors.length ? { ...row, selected: false } : row) ?? null)} /> : null}
      </Card>
      {checked.map(({ row, errors, warnings }) => <Card key={row.id} title={`Línea ${row.lineNumber}`}>
        <Body>{row.raw}</Body>
        <Options value={row.kind} options={[{ value: 'player', label: 'Plantilla' }, { value: 'trial', label: 'PRUEBAS' }, { value: 'aid', label: 'AYUDAS' }]} onChange={kind => edit(row.id, { kind, selected: kind !== 'aid', requiresReview: true })} disabled={busy} />
        {row.kind === 'aid' ? <><Field label={`Ayuda línea ${row.lineNumber}`} value={row.eaId} onChangeText={eaId => edit(row.id, { eaId })} multiline editable={!busy} /><Body>Solo vista previa. Añade esta anotación a la convocatoria que corresponda; no se importa a la plantilla.</Body></> : <>
          <Switch accessibilityLabel={`Incluir línea ${row.lineNumber}`} value={row.selected} onValueChange={selected => edit(row.id, { selected })} disabled={busy} />
          {row.kind === 'player' ? <Field label={`Dorsal línea ${row.lineNumber}`} keyboardType="number-pad" value={row.jerseyText} onChangeText={jerseyText => edit(row.id, { jerseyText })} editable={!busy} /> : null}
          <Field label={`${row.kind === 'trial' ? 'Nombre de la prueba' : 'EA ID'} línea ${row.lineNumber}`} value={row.eaId} onChangeText={eaId => edit(row.id, { eaId })} autoCapitalize="none" editable={!busy} />
          {row.kind === 'player' ? <Options value={row.category} options={categories.map(value => ({ value, label: categoryLabels[value] }))} onChange={category => edit(row.id, { category })} disabled={busy} /> : <>
            <Field label={`Observaciones línea ${row.lineNumber}`} value={row.notes} onChangeText={notes => edit(row.id, { notes })} maxLength={1000} multiline editable={!busy} />
          </>}
          {row.availability ? <Body>Disponibilidad detectada: {row.availability === 'available' ? 'Disponible' : row.availability === 'unavailable' ? 'No disponible' : 'Backup'} · no se guardará.</Body> : null}
          {row.requiresReview ? <Button secondary label={`Confirmar interpretación línea ${row.lineNumber}`} disabled={busy} onPress={() => edit(row.id, { requiresReview: false })} /> : null}
          {row.selected ? errors.map(error => <Message key={error} error>{error}</Message>) : <Body>Esta entrada no se importará.</Body>}
        </>}
        {warnings.map(warning => <Body key={warning}>{warning}</Body>)}
      </Card>)}
      <Button label={`Revisar importación de ${players.length + trials.length} entradas`} disabled={isDemo || busy || Boolean(invalid.length) || !(players.length + trials.length) || existing.isLoading || Boolean(existing.error)} onPress={() => setConfirming(true)} />
    </> : null}
    <ConfirmDialog visible={confirming} title="Confirmar importación" description={`Se añadirán ${players.length} jugadores sin registrar y ${trials.length} pruebas, en el orden revisado. AYUDAS y disponibilidad no se guardarán. No se reemplazarán fichas existentes.`} confirmLabel="Importar entradas" busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => { void submit(); }} />
  </Screen>;
}
