import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/icon-button';
import { backendErrorMessage } from '@/lib/backend-result';
import { Body, Button, Card, Field, Message } from '@/components/ui';
import { formatMatchDate } from '@/lib/format';
import { t, useLanguage } from '@/features/i18n/runtime';
import { colors } from '@/theme';
import { incidentKinds, incidentLabel, type IncidentKind } from './model';
import { deletePlayerIncident, incidentError, recordPlayerIncident, type PlayerIncident } from './service';
import { useIncidentClock } from './use-incident-clock';

export function IncidentDetails({ incident, now, onDelete }: { incident: PlayerIncident; now: number; onDelete?: (() => void) | undefined }) {
  useLanguage();
  return <Card title={incident.player_name} action={onDelete ? <IconButton icon="trash" danger label={t('Eliminar incidencia de {{v0}}', { v0: incident.player_name })} onPress={onDelete} /> : undefined}>
    <Body>{t(incidentLabel(incident.kind))}</Body>
    {incident.note ? <Body>{incident.note}</Body> : null}
    <Body>{t('Convocatoria: {{v0}}', { v0: formatMatchDate(incident.match_starts_at, incident.match_timezone) })}</Body>
    <Body>{t('Registrada por {{v0}} · {{v1}}', { v0: incident.captain_name, v1: formatMatchDate(incident.created_at, incident.match_timezone) })}</Body>
    <Body>{t(now < Date.parse(incident.expires_at) ? 'Vigente hasta {{v0}}' : 'Archivada desde {{v0}}', { v0: formatMatchDate(incident.expires_at, incident.match_timezone) })}</Body>
  </Card>;
}

function IncidentModal({ title, children, close, busy = false, closeLabel = 'Cerrar' }: { title: string; children: React.ReactNode; close: () => void; busy?: boolean; closeLabel?: string }) {
  const insets = useSafeAreaInsets();
  return <Modal transparent animationType="fade" onRequestClose={() => { if (!busy) close(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Card title={t(title)}>{children}<Button secondary label={t(closeLabel)} disabled={busy} onPress={close} /></Card>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

function IncidentDeletion({ incident, onDeleted, busy, onBusyChange }: { incident: PlayerIncident; onDeleted: (id: string) => void; busy: boolean; onBusyChange: (busy: boolean) => void }) {
  useLanguage();
  const [error, setError] = useState('');
  async function remove() {
    if (busy) return;
    onBusyChange(true); setError('');
    try { await deletePlayerIncident(incident.id); onDeleted(incident.id); }
    catch (failure) { setError(backendErrorMessage(failure)); }
    finally { onBusyChange(false); }
  }
  return <>
    <Body>{t('Se eliminará la incidencia de {{v0}} del histórico y dejará de marcar al jugador. Sus valoraciones no cambiarán.', { v0: incident.player_name })}</Body>
    <Body>{t(incidentLabel(incident.kind))}{incident.note ? ` · ${incident.note}` : ''}</Body>
    {error ? <Message error>{t(error)}</Message> : null}
    <Button label={busy ? t('Un momento…') : t('Eliminar incidencia')} disabled={busy} onPress={() => void remove()} />
  </>;
}

export function DeleteIncidentDialog({ incident, onDeleted, onCancel }: { incident: PlayerIncident; onDeleted: (id: string) => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  return <IncidentModal title="Eliminar incidencia" close={onCancel} closeLabel="Cancelar" busy={busy}>
    <IncidentDeletion incident={incident} onDeleted={onDeleted} busy={busy} onBusyChange={setBusy} />
  </IncidentModal>;
}

export function LineupIncidentsModal({ incidents, close, onDeleted }: { incidents: PlayerIncident[]; close: () => void; onDeleted: (id: string) => void }) {
  useLanguage();
  const now = useIncidentClock(incidents);
  const [deleting, setDeleting] = useState<PlayerIncident | null>(null);
  const [busy, setBusy] = useState(false);
  return <IncidentModal title={deleting ? 'Eliminar incidencia' : 'Incidencias de jugadores alineados'} close={deleting ? () => setDeleting(null) : close} closeLabel={deleting ? 'Cancelar' : 'Cerrar'} busy={busy}>
    {deleting ? <IncidentDeletion key={deleting.id} incident={deleting} busy={busy} onBusyChange={setBusy} onDeleted={id => { onDeleted(id); setDeleting(null); }} /> : <>
      <Body>{t('Solo se muestran las incidencias vigentes de los jugadores del once. Las demás permanecen en el histórico.')}</Body>
      {incidents.map(incident => <IncidentDetails key={incident.id} incident={incident} now={now} onDelete={() => setDeleting(incident)} />)}
      {!incidents.length ? <Body>{t('Los jugadores alineados no tienen incidencias vigentes.')}</Body> : null}
    </>}
  </IncidentModal>;
}

export function RecordIncidentModal({ callId, entryId, playerName, close, saved }: { callId: string; entryId: string; playerName: string; close: () => void; saved: (incident: PlayerIncident) => void }) {
  useLanguage();
  const [kind, setKind] = useState<IncidentKind>('late');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function record() {
    if (busy) return;
    setBusy(true); setError('');
    try { saved(await recordPlayerIncident(callId, entryId, kind, note.trim())); }
    catch (failure) { setError(incidentError(failure)); }
    finally { setBusy(false); }
  }
  return <IncidentModal title="Registrar incidencia" close={close} busy={busy}>
    <Body>{playerName}</Body>
    <Body>{t('La marca durará una semana desde el registro. Después, la incidencia solo aparecerá en el histórico. Solo los capitanes pueden consultarla.')}</Body>
    <Picker accessibilityLabel={t('Motivo de la incidencia')} selectedValue={kind} enabled={!busy} onValueChange={value => setKind(value as IncidentKind)} style={{ color: colors.text, backgroundColor: colors.surface, minHeight: 48 }}>
      {incidentKinds.map(item => <Picker.Item key={item.value} label={t(item.label)} value={item.value} />)}
    </Picker>
    <Field label={t('Observación')} value={note} onChangeText={setNote} editable={!busy} multiline maxLength={500} placeholder={t('Describe lo ocurrido, si es necesario')} />
    {error ? <Message error>{t(error)}</Message> : null}
    <Button label={busy ? 'Guardando…' : 'Guardar incidencia'} disabled={busy || (kind === 'other' && !note.trim())} onPress={() => void record()} />
  </IncidentModal>;
}
