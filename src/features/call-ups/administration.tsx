import { useState } from 'react';
import { View } from 'react-native';
import { Body, DemoNotice, Field, Message } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { IconButton } from '@/components/icon-button';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { clubLocalDateTime, clubLocalTimeToInstant } from './local-time';
import { callUpErrorMessage, callStatusLabels } from './availability';
import { updateCallUp } from './service';
import { CompactPanel } from './compact-panel';
import type { Tables } from '@/types/database';

type Action = 'edit' | 'open' | 'closed' | 'cancelled';
export function CallUpAdministration({ call, onSaved }: { call: Tables<'call_ups'>; onSaved: () => void }) {
  const { isDemo } = useAuth(); const { activeClub, currentMembership } = useClub();
  const initial = clubLocalDateTime(call.timezone, new Date(call.starts_at));
  const [date, setDate] = useState(initial.date); const [time, setTime] = useState(initial.time);
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const admin = currentMembership?.role === 'admin' && activeClub?.id === call.club_id;
  function choose(value: Action) { setError(''); setDate(initial.date); setTime(initial.time); setAction(value); }
  async function save() {
    if (!admin || isDemo || busy || !action) return;
    let instant = call.starts_at;
    if (action === 'edit') {
      try { instant = clubLocalTimeToInstant(date.trim(), time.trim(), call.timezone); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Revisa la fecha y hora.'); return; }
    }
    setBusy(true); setError('');
    try { await updateCallUp(call.id, instant, action === 'edit' ? call.status : action); setAction(null); onSaved(); }
    catch (cause) { setError(callUpErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  if (!admin) return null;
  const title = action === 'edit' ? 'Modificar fecha y hora' : action === 'open' ? 'Abrir convocatoria' : action === 'closed' ? 'Cerrar convocatoria' : 'Cancelar convocatoria';
  return <CompactPanel title="Administrar convocatoria" expanded={expanded} onToggle={() => setExpanded(value => !value)} subtle>
    <Body>Estado: {callStatusLabels[call.status]}. Cerrar o cancelar conserva la fotografía y las respuestas.</Body>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      <IconButton icon="edit" label="Modificar fecha y hora" disabled={busy} onPress={() => choose('edit')} />
      {call.status !== 'open' ? <IconButton icon="play" label="Abrir convocatoria" disabled={busy || call.local_date < clubLocalDateTime(call.timezone).date} onPress={() => choose('open')} /> : null}
      {call.status === 'open' || call.status === 'draft' ? <IconButton icon="lock" label="Cerrar convocatoria" disabled={busy} onPress={() => choose('closed')} /> : null}
      {call.status !== 'cancelled' ? <IconButton icon="cancel" label="Cancelar convocatoria" danger disabled={busy} onPress={() => choose('cancelled')} /> : null}
    </View>
    <ConfirmDialog visible={action !== null} title={title} description={action === 'edit' ? `Horario del club: ${call.timezone}. Solo puede existir una convocatoria por fecha local; la fotografía y respuestas se conservarán.` : 'Se conservarán los jugadores, respuestas, PRUEBAS y AYUDAS. Solo una convocatoria abierta permite responder.'}
      confirmLabel={title} busy={busy} disabled={isDemo} onCancel={() => setAction(null)} onConfirm={() => { void save(); }}>
      {action === 'edit' ? <><Field label="Nueva fecha (AAAA-MM-DD)" value={date} onChangeText={setDate} maxLength={10} editable={!busy} /><Field label="Nueva hora (HH:mm)" value={time} onChangeText={setTime} maxLength={5} editable={!busy} /></> : null}
      {isDemo ? <DemoNotice /> : null}
      {error ? <Message error>{error}</Message> : null}
    </ConfirmDialog>
  </CompactPanel>;
}
