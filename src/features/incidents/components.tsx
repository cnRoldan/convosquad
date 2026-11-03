import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Field, Message } from '@/components/ui';
import { formatMatchDate } from '@/lib/format';
import { t, useLanguage } from '@/features/i18n/runtime';
import { colors } from '@/theme';
import { incidentKinds, incidentLabel, type IncidentKind } from './model';
import { incidentError, recordPlayerIncident, type PlayerIncident } from './service';
import { useIncidentClock } from './use-incident-clock';

export function IncidentDetails({ incident, now }: { incident: PlayerIncident; now: number }) {
  useLanguage();
  return <Card title={incident.player_name}>
    <Body>{t(incidentLabel(incident.kind))}</Body>
    {incident.note ? <Body>{incident.note}</Body> : null}
    <Body>{t('Convocatoria: {{v0}}', { v0: formatMatchDate(incident.match_starts_at, incident.match_timezone) })}</Body>
    <Body>{t('Registrada por {{v0}} · {{v1}}', { v0: incident.captain_name, v1: formatMatchDate(incident.created_at, incident.match_timezone) })}</Body>
    <Body>{t(now < Date.parse(incident.expires_at) ? 'Vigente hasta {{v0}}' : 'Archivada desde {{v0}}', { v0: formatMatchDate(incident.expires_at, incident.match_timezone) })}</Body>
  </Card>;
}

function IncidentModal({ title, children, close, busy = false }: { title: string; children: React.ReactNode; close: () => void; busy?: boolean }) {
  const insets = useSafeAreaInsets();
  return <Modal transparent animationType="fade" onRequestClose={() => { if (!busy) close(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Card title={t(title)}>{children}<Button secondary label="Cerrar" disabled={busy} onPress={close} /></Card>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export function LineupIncidentsModal({ incidents, close }: { incidents: PlayerIncident[]; close: () => void }) {
  useLanguage();
  const now = useIncidentClock(incidents);
  return <IncidentModal title="Incidencias de jugadores alineados" close={close}>
    <Body>{t('Solo se muestran las incidencias vigentes de los jugadores del once. Las demás permanecen en el histórico.')}</Body>
    {incidents.map(incident => <IncidentDetails key={incident.id} incident={incident} now={now} />)}
    {!incidents.length ? <Body>{t('Los jugadores alineados no tienen incidencias vigentes.')}</Body> : null}
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
