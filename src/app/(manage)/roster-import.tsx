import { t, useLanguage } from '@/features/i18n/runtime';
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
  useLanguage();
  const { session, isDemo } = useAuth(); const { activeClub } = useClub();
  return <RosterImportEditor key={`${session?.user.id}:${activeClub?.id}:${isDemo}`} />;
}
function RosterImportEditor() {
  useLanguage();
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
  function preview() { const parsed = parseRosterText(text); setRows(parsed.error ? null : parsed.rows); setMetadata(parsed.metadata); setMessage(parsed.error ?? t("Revisa todas las entradas antes de importar.")); }
  function edit(id: string, change: Partial<ImportRow>) { setRows(current => current?.map(row => row.id === id ? { ...row, ...change } : row) ?? null); }
  async function submit() {
    if (!clubId || isDemo || busy || invalid.length || !(players.length + trials.length) || existing.isLoading || existing.error) return;
    setBusy(true); setMessage('');
    try {
      const saved = await importRoster(clubId, players, trials);
      if (saved.players !== players.length || saved.trials !== trials.length) throw new Error(t("Resultado incompleto."));
      setRows(null); setText(''); setConfirming(false); refreshRoster();
      notifyClub(clubId, t("Importados {{v0}} jugadores y {{v1}} pruebas.", { v0: saved.players, v1: saved.trials })); router.replace('/roster');
    } catch (error) { setMessage(backendErrorMessage(error)); existing.reload(); setConfirming(false); } finally { setBusy(false); }
  }
  return <Screen>
    <Heading title={t("Importar desde WhatsApp")} subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    <Body>{t("Se reconocen categorías, dorsales con emojis, PRUEBAS y AYUDAS. La plantilla existente se conserva. Las respuestas de convocatorias nunca se importan.")}</Body>
    <Field label={t("Plantilla de WhatsApp")} multiline value={text} onChangeText={value => { setText(value); setRows(null); }} editable={!busy} textAlignVertical="top" style={{ minHeight: 180 }} placeholder={t("🧤 PORTEROS\n2️⃣3️⃣alexinstic23 ✅\nPRUEBAS\nTrialPlayer (DFC)")} />
    <Button label={t("Analizar plantilla")} disabled={busy || existing.isLoading} onPress={preview} />
    {existing.isLoading ? <Body>{t("Comprobando plantilla y pruebas…")}</Body> : null}
    {existing.error ? <><Message error>{existing.error}</Message><Button label={t("Reintentar")} onPress={existing.reload} /></> : null}
    {message ? <Message>{message}</Message> : null}
    {metadata.length ? <Card title={t("Cabecera informativa")}><Body>{metadata.join(' · ')}</Body><Body>{t("No cambia la fecha ni los datos de una convocatoria.")}</Body></Card> : null}
    {rows ? <>
      <Card title={t("Vista previa")}><Body>{players.length} {t("jugadores válidos ·")} {trials.length} {t("pruebas válidas ·")} {invalid.length} {t("entradas con errores")}</Body>
        {invalid.length ? <Button secondary label={t("Excluir entradas con errores")} disabled={busy} onPress={() => setRows(current => current?.map(row => checked.find(entry => entry.row.id === row.id)?.errors.length ? { ...row, selected: false } : row) ?? null)} /> : null}
      </Card>
      {checked.map(({ row, errors, warnings }) => <Card key={row.id} title={t("Línea {{v0}}", { v0: row.lineNumber })}>
        <Body>{row.raw}</Body>
        <Options value={row.kind} options={[{ value: 'player', label: t("Plantilla") }, { value: 'trial', label: 'PRUEBAS' }, { value: 'aid', label: 'AYUDAS' }]} onChange={kind => edit(row.id, { kind, selected: kind !== 'aid', requiresReview: true })} disabled={busy} />
        {row.kind === 'aid' ? <><Field label={t("Ayuda línea {{v0}}", { v0: row.lineNumber })} value={row.eaId} onChangeText={eaId => edit(row.id, { eaId })} multiline editable={!busy} /><Body>{t("Solo vista previa. Añade esta anotación a la convocatoria que corresponda; no se importa a la plantilla.")}</Body></> : <>
          <Switch accessibilityLabel={t("Incluir línea {{v0}}", { v0: row.lineNumber })} value={row.selected} onValueChange={selected => edit(row.id, { selected })} disabled={busy} />
          {row.kind === 'player' ? <Field label={t("Dorsal línea {{v0}}", { v0: row.lineNumber })} keyboardType="number-pad" value={row.jerseyText} onChangeText={jerseyText => edit(row.id, { jerseyText })} editable={!busy} /> : null}
          <Field label={t("{{v0}} línea {{v1}}", { v0: row.kind === 'trial' ? t("Nombre de la prueba") : t("EA ID"), v1: row.lineNumber })} value={row.eaId} onChangeText={eaId => edit(row.id, { eaId })} autoCapitalize="none" editable={!busy} />
          {row.kind === 'player' ? <Options value={row.category} options={categories.map(value => ({ value, label: t(categoryLabels[value]) }))} onChange={category => edit(row.id, { category })} disabled={busy} /> : <>
            <Field label={t("Observaciones línea {{v0}}", { v0: row.lineNumber })} value={row.notes} onChangeText={notes => edit(row.id, { notes })} maxLength={1000} multiline editable={!busy} />
          </>}
          {row.availability ? <Body>{t("Disponibilidad detectada:")}{row.availability === 'available' ? t("Disponible") : row.availability === 'unavailable' ? t("No disponible") : t("Backup")} {t("· no se guardará.")}</Body> : null}
          {row.requiresReview ? <Button secondary label={t("Confirmar interpretación línea {{v0}}", { v0: row.lineNumber })} disabled={busy} onPress={() => edit(row.id, { requiresReview: false })} /> : null}
          {row.selected ? errors.map(error => <Message key={error} error>{error}</Message>) : <Body>{t("Esta entrada no se importará.")}</Body>}
        </>}
        {warnings.map(warning => <Body key={warning}>{warning}</Body>)}
      </Card>)}
      <Button label={t("Revisar importación de {{v0}} entradas", { v0: players.length + trials.length })} disabled={isDemo || busy || Boolean(invalid.length) || !(players.length + trials.length) || existing.isLoading || Boolean(existing.error)} onPress={() => setConfirming(true)} />
    </> : null}
    <ConfirmDialog visible={confirming} title={t("Confirmar importación")} description={t("Se añadirán {{v0}} jugadores sin registrar y {{v1}} pruebas, en el orden revisado. AYUDAS y disponibilidad no se guardarán. No se reemplazarán fichas existentes.", { v0: players.length, v1: trials.length })} confirmLabel={t("Importar entradas")} busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => { void submit(); }} />
  </Screen>;
}
