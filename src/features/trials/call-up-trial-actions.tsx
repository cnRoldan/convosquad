import { useState } from 'react';
import { View } from 'react-native';
import { IconButton } from '@/components/icon-button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Message } from '@/components/ui';
import { PhoneContact } from '@/features/call-ups/phone-contact';
import { normalizePhone } from '@/features/call-ups/phone';
import { saveCallUpContact } from '@/features/call-ups/contacts';
import { backendErrorMessage } from '@/lib/backend-result';
import type { Tables } from '@/types/database';
import { removeCallUpTrial } from './service';
export function CallUpTrialActions({ trial, phone, editable, disabled, onSaved }: { trial: Tables<'call_up_trials'>; phone: string; editable: boolean; disabled: boolean; onSaved: () => void }) {
  const [value, setValue] = useState(phone);
  const [busy, setBusy] = useState(false); const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  async function mutate(remove: boolean) {
    if (!editable || busy || (!remove && disabled)) return;
    setBusy(true); setMessage('');
    try {
      if (remove) await removeCallUpTrial(trial.id);
      else await saveCallUpContact(trial.call_up_id, 'trial', trial.id, normalizePhone(value));
      setConfirming(false); onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : backendErrorMessage(error)); }
    finally { setBusy(false); }
  }
  return <View style={{gap: 8}}>
    <PhoneContact phone={value} label={trial.ea_id_snapshot} editable={editable && !disabled && !busy} onChange={setValue} />
    {editable ? <View style={{flexDirection: 'row', gap: 4}}>
      <IconButton icon="save" label={`Guardar teléfono de ${trial.ea_id_snapshot}`} disabled={busy || disabled} onPress={() => { void mutate(false); }} />
      <IconButton icon="trash" label={`Quitar prueba ${trial.ea_id_snapshot}`} danger disabled={busy} onPress={() => setConfirming(true)} />
    </View> : null}
    {message ? <Message error>{message}</Message> : null}
    <ConfirmDialog visible={confirming} title="Quitar prueba de la convocatoria" description="¿Quieres quitar esta prueba de la convocatoria? Seguirá guardada en la plantilla del club y las convocatorias anteriores no cambiarán." busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => { void mutate(true); }} />
  </View>;
}
