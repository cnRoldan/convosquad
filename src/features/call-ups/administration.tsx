import { useState } from 'react';
import { View } from 'react-native';
import { Body, DemoNotice, Field, Message } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { IconButton } from '@/components/icon-button';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { clubLocalDateTime, clubLocalTimeToInstant } from './local-time';
import { callUpErrorMessage, callStatusLabels } from './availability';
import { refreshCallUpRoster, updateCallUp } from './service';
import { CompactPanel } from './compact-panel';
import type { Tables } from '@/types/database';

type Action = 'edit' | 'open' | 'closed' | 'cancelled' | 'refresh';
export function CallUpAdministration({ call, onSaved }: { call: Tables<'call_ups'>; onSaved: (message?: string) => void }) {
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
    try {
      const refreshing = action === 'refresh' || (action === 'open' && call.status === 'cancelled');
      if (refreshing) await refreshCallUpRoster(call.id, action === 'open');
      else await updateCallUp(call.id, instant, action === 'edit' ? call.status : action);
      setAction(null);
      onSaved(refreshing ? 'Plantilla de la convocatoria actualizada. Se conservan las respuestas de quienes continúan y las AYUDAS.' : undefined);
    }
    catch (cause) { setError(callUpErrorMessage(cause)); }
    finally { setBusy(false); }
  }
  if (!admin) return null;
  const current = call.local_date >= clubLocalDateTime(call.timezone).date;
  const resuming = action === 'open' && call.status === 'cancelled';
  const title = action === 'refresh' ? 'Actualizar plantilla' : action === 'edit' ? 'Modificar fecha y hora' : resuming ? 'Reanudar con plantilla actual' : action === 'open' ? 'Abrir convocatoria' : action === 'closed' ? 'Cerrar convocatoria' : 'Cancelar convocatoria';
  return <CompactPanel title="Administrar convocatoria" expanded={expanded} onToggle={() => setExpanded(value => !value)} subtle>
    <View style={{ paddingTop: 12, paddingBottom: 6, gap: 12 }}>
    <Body>Estado: {callStatusLabels[call.status]}. Cerrar o cancelar conserva los datos; reanudar una cancelada incorpora la plantilla actual.</Body>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <IconButton icon="edit" label="Modificar fecha y hora" disabled={busy} onPress={() => choose('edit')} />
      {(call.status === 'open' || call.status === 'draft') && current ? <IconButton icon="refresh" label="Actualizar plantilla de convocatoria" disabled={busy} onPress={() => choose('refresh')} /> : null}
      {call.status !== 'open' ? <IconButton icon="play" label={call.status === 'cancelled' ? 'Reanudar con plantilla actual' : 'Abrir convocatoria'} disabled={busy || !current} onPress={() => choose('open')} /> : null}
      {call.status === 'open' || call.status === 'draft' ? <IconButton icon="lock" label="Cerrar convocatoria" disabled={busy} onPress={() => choose('closed')} /> : null}
      {call.status !== 'cancelled' ? <IconButton icon="cancel" label="Cancelar convocatoria" danger disabled={busy} onPress={() => choose('cancelled')} /> : null}
    </View>
    </View>
    <ConfirmDialog visible={action !== null} title={title} description={action === 'refresh' || resuming ? 'Se incorporarán los jugadores, categorías, dorsales, orden y PRUEBAS de la plantilla actual. Se conservarán las respuestas de quienes continúen y las AYUDAS. Los nuevos empezarán sin responder y los retirados dejarán de aparecer en esta convocatoria.' : action === 'edit' ? `Horario del club: ${call.timezone}. Solo puede existir una convocatoria por fecha local; la fotografía y respuestas se conservarán.` : 'Se conservarán los jugadores, respuestas, PRUEBAS y AYUDAS. Solo una convocatoria abierta permite responder.'}
      confirmLabel={title} busy={busy} disabled={isDemo} onCancel={() => setAction(null)} onConfirm={() => { void save(); }}>
      {action === 'edit' ? <><Field label="Nueva fecha (AAAA-MM-DD)" value={date} onChangeText={setDate} maxLength={10} editable={!busy} /><Field label="Nueva hora (HH:mm)" value={time} onChangeText={setTime} maxLength={5} editable={!busy} /></> : null}
      {isDemo ? <DemoNotice /> : null}
      {error ? <Message error>{error}</Message> : null}
    </ConfirmDialog>
  </CompactPanel>;
}
