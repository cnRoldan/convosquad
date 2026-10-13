import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Switch } from 'react-native';
import { Body, Button, Card, DemoNotice, Field, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { importPlayers, listPlayers } from '@/features/players/service';
import { parseRosterText, validateImportRows } from '@/features/players/import-parser';
import type { ImportRow } from '@/features/players/import-parser';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';

export default function RosterImportScreen() {
  const { session, isDemo } = useAuth();
  const { activeClub, roster, refreshRoster, notifyClub } = useClub();
  const clubId = activeClub?.id;
  const [text, setText] = useState('');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const load = useCallback(() => clubId ? listPlayers(clubId, true) : Promise.resolve([]), [clubId]);
  const existing = useResource(`import-existing:${session?.user.id}:${clubId}`, load, Boolean(session && clubId) && !isDemo);
  const current = useMemo(() => isDemo ? roster : existing.data?.map((player) => ({ eaId: player.ea_id, jerseyNumber: player.jersey_number })) ?? [], [isDemo, roster, existing.data]);
  const checked = useMemo(() => validateImportRows(rows ?? [], current), [rows, current]);
  const selected = checked.filter((entry) => entry.row.selected);
  const invalid = selected.filter((entry) => entry.errors.length);
  const valid = selected.flatMap((entry) => entry.player ? [entry.player] : []);
  const warnings = selected.reduce((count, entry) => count + entry.warnings.length, 0);

  function preview() {
    const parsed = parseRosterText(text);
    setRows(parsed.error ? null : parsed.rows);
    setMessage(parsed.error ?? 'Revisa cada línea. Puedes corregirla o excluirla antes de importar.');
  }
  function edit(id: string, change: Partial<ImportRow>) {
    setRows((current) => current?.map((row) => row.id === id ? { ...row, ...change } : row) ?? null);
  }
  async function submit() {
    if (!clubId || isDemo || busy || invalid.length || !valid.length || existing.isLoading || existing.error) return;
    setBusy(true);
    setMessage('');
    try {
      const saved = await importPlayers(clubId, valid);
      if (saved.length !== valid.length) throw new Error('El servidor no devolvió el lote completo.');
      setConfirming(false);
      setRows(null);
      setText('');
      refreshRoster();
      notifyClub(clubId, `Se han importado ${saved.length} jugadores.`);
      router.replace('/roster');
    } catch (error) { setMessage(backendErrorMessage(error)); existing.reload(); setConfirming(false); }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading title="Importar desde WhatsApp" subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    <Body>Pega líneas como «10 - AlexR10 (MCO)». La plantilla existente se conserva.</Body>
    <Field label="Plantilla de WhatsApp" multiline value={text} onChangeText={(value) => { setText(value); setRows(null); }} editable={!busy}
      textAlignVertical="top" style={{ minHeight: 180 }} placeholder={'1 - AlexR10 (POR)\n10 - Mario (MCO)'} />
    <Button label="Analizar plantilla" disabled={busy || existing.isLoading} onPress={preview} />
    {existing.isLoading ? <Body>Comprobando la plantilla existente…</Body> : null}
    {existing.error ? <><Message error>{existing.error}</Message><Button secondary label="Reintentar" onPress={existing.reload} /></> : null}
    {message ? <Message>{message}</Message> : null}
    {rows ? <>
      <Card title="Vista previa">
        <Body>{valid.length} jugadores válidos seleccionados · {invalid.length} líneas con errores · {warnings} avisos de dorsal</Body>
        {invalid.length ? <Button secondary label="Excluir líneas con errores" onPress={() => setRows((current) => current?.map((row) => checked.find((entry) => entry.row.id === row.id)?.errors.length ? { ...row, selected: false } : row) ?? null)} /> : null}
      </Card>
      {checked.map(({ row, errors, warnings }) => <Card key={row.id} title={`Línea ${row.lineNumber}`}>
        <Body>{row.raw}</Body>
        <Switch accessibilityLabel={`Incluir línea ${row.lineNumber}`} value={row.selected} onValueChange={(selected) => edit(row.id, { selected })} disabled={busy} />
        <Field label={`Dorsal línea ${row.lineNumber}`} keyboardType="number-pad" value={row.jerseyText} onChangeText={(jerseyText) => edit(row.id, { jerseyText })} editable={!busy} />
        <Field label={`EA ID línea ${row.lineNumber}`} value={row.eaId} onChangeText={(eaId) => edit(row.id, { eaId })} autoCapitalize="none" editable={!busy} />
        <Field label={`Posición línea ${row.lineNumber}`} value={row.positionText} onChangeText={(positionText) => edit(row.id, { positionText })} autoCapitalize="characters" maxLength={3} editable={!busy} />
        {row.selected ? <>{errors.map((error) => <Message key={error} error>{error}</Message>)}{warnings.map((warning) => <Body key={warning}>{warning}</Body>)}</> : <Body>Esta línea no se importará.</Body>}
      </Card>)}
      <Body>Posiciones: POR, DFC, LI, LD, MCD, MC, MCO, MI, MD, EI, ED, DC.</Body>
      <Button label={`Revisar importación de ${valid.length} jugadores`} disabled={isDemo || busy || Boolean(invalid.length) || !valid.length || existing.isLoading || Boolean(existing.error)} onPress={() => setConfirming(true)} />
    </> : null}
    <ConfirmDialog visible={confirming} title="Confirmar importación" description={`Se añadirán ${valid.length} jugadores sin registrar. ${warnings ? `Hay ${warnings} avisos de dorsal repetido. ` : ''}${(rows?.length ?? 0) - selected.length} líneas quedarán excluidas. La plantilla existente y sus históricos se conservarán.`}
      confirmLabel="Importar jugadores" busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => { void submit(); }} />
  </Screen>;
}
