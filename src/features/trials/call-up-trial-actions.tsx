import { t, useLanguage } from '@/features/i18n/runtime';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { IconButton } from '@/components/icon-button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Message } from '@/components/ui';
import { PrivatePhoneField } from '@/features/call-ups/private-phone-field';
import { normalizePhone, whatsappUrl } from '@/features/call-ups/phone';
import { saveCallUpContact } from '@/features/call-ups/contacts';
import { backendErrorMessage } from '@/lib/backend-result';
import type { Tables } from '@/types/database';
import { removeCallUpTrial } from './service';
export function CallUpTrialActions({ trial, phone, editable, disabled, onSaved }: { trial: Tables<'call_up_trials'>; phone: string; editable: boolean; disabled: boolean; onSaved: () => void }) {
  useLanguage();
  const [value, setValue] = useState(phone);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false); const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  async function mutate(remove: boolean) {
    if (!editable || busy || (!remove && disabled)) return;
    setBusy(true); setMessage('');
    try {
      if (remove) await removeCallUpTrial(trial.id);
      else await saveCallUpContact(trial.call_up_id, 'trial', trial.id, normalizePhone(value));
      setConfirming(false); setEditing(false); onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : backendErrorMessage(error)); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12, paddingTop: 12 }}>
    {editable && editing ? <PrivatePhoneField label={t("Teléfono")} value={value} onChangeText={setValue} keyboardType="phone-pad" maxLength={30} editable={!disabled && !busy} /> : null}
    <View style={{flexDirection: 'row', gap: 4}}>
      {editable ? <>
        <IconButton icon={editing ? 'save' : 'edit'} label={t("{{v0}} teléfono de {{v1}}", { v0: editing ? t("Guardar") : t("Editar"), v1: trial.ea_id_snapshot })} disabled={busy || disabled} onPress={() => {
          if (editing) void mutate(false); else { setMessage(''); setEditing(true); }
        }} />
        <IconButton icon="trash" label={t("Quitar prueba {{v0}}", { v0: trial.ea_id_snapshot })} danger disabled={busy} onPress={() => setConfirming(true)} />
      </> : null}
      <IconButton icon="whatsapp" label={t("WhatsApp de {{v0}}", { v0: trial.ea_id_snapshot })} disabled={busy || disabled || !phone} onPress={() => {
        setMessage('');
        void (async () => { try { await Linking.openURL(whatsappUrl(phone)); } catch { setMessage(t("No se pudo abrir WhatsApp. Revisa el número e inténtalo de nuevo.")); } })();
      }} />
    </View>
    {message ? <Message error>{message}</Message> : null}
    <ConfirmDialog visible={confirming} title={t("Quitar prueba de la convocatoria")} description={t("¿Quieres quitar esta prueba de la convocatoria? Seguirá guardada en la plantilla del club y las convocatorias anteriores no cambiarán.")} busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => { void mutate(true); }} />
  </View>;
}
