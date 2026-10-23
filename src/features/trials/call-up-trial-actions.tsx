import { t, useLanguage } from '@/features/i18n/runtime';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { IconButton } from '@/components/icon-button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Message } from '@/components/ui';
import { whatsappUrl } from '@/features/call-ups/phone';
import { backendErrorMessage } from '@/lib/backend-result';
import { colors } from '@/theme';
import type { Tables } from '@/types/database';
import { removeCallUpTrial } from './service';
export function CallUpTrialActions({ trial, phone, editable, disabled, onSaved }: { trial: Tables<'call_up_trials'>; phone: string; editable: boolean; disabled: boolean; onSaved: () => void }) {
  useLanguage();
  const [busy, setBusy] = useState(false); const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  async function remove() {
    if (!editable || busy) return;
    setBusy(true); setMessage('');
    try {
      await removeCallUpTrial(trial.id);
      setConfirming(false); onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : backendErrorMessage(error)); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: 12 }}>
    <View style={styles.header}>
      <Text style={styles.name}>{trial.ea_id_snapshot}</Text>
      <View style={styles.actions}>
        {editable ? <>
          <IconButton icon="edit" label={t("Editar prueba de {{v0}}", { v0: trial.ea_id_snapshot })} disabled={busy || disabled || !trial.source_trial_id} onPress={() => {
            if (!trial.source_trial_id) return;
            router.push({ pathname: '/trials/[id]', params: { id: trial.source_trial_id, returnTo: 'call-up', callUpId: trial.call_up_id } });
          }} />
          <IconButton icon="trash" label={t("Quitar prueba {{v0}}", { v0: trial.ea_id_snapshot })} danger disabled={busy} onPress={() => setConfirming(true)} />
        </> : null}
        <IconButton icon="whatsapp" label={t("WhatsApp de {{v0}}", { v0: trial.ea_id_snapshot })} disabled={busy || disabled || !phone} onPress={() => {
          setMessage('');
          void (async () => { try { await Linking.openURL(whatsappUrl(phone)); } catch { setMessage("No se pudo abrir WhatsApp. Revisa el número e inténtalo de nuevo."); } })();
        }} />
      </View>
    </View>
    {trial.notes_snapshot ? <Text style={styles.notes}>{trial.notes_snapshot}</Text> : null}
    {message ? <Message error>{message}</Message> : null}
    <ConfirmDialog visible={confirming} title={t("Quitar prueba de la convocatoria")} description={t("¿Quieres quitar esta prueba de la convocatoria? Seguirá guardada en la plantilla del club y las convocatorias anteriores no cambiarán.")} busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => { void remove(); }} />
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  notes: { color: colors.muted, fontSize: 12, lineHeight: 18 },
});
