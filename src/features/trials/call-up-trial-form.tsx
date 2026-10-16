import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Message } from '@/components/ui';
import { backendErrorMessage } from '@/lib/backend-result';
import { normalizePhone } from '@/features/call-ups/phone';
import { addCallUpTrialWithContact } from './service';

export function CallUpTrialForm({ callUpId, onSaved }: { callUpId: string; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function save() {
    if (busy) return;
    setFailed(true);
    if (!name.trim() || name.trim().length > 64) return setMessage('Introduce un nombre de hasta 64 caracteres.');
    setBusy(true); setMessage('');
    try {
      await addCallUpTrialWithContact(callUpId, name.trim(), normalizePhone(phone));
      setName(''); setPhone(''); setFailed(false); setMessage('Prueba añadida a la convocatoria y guardada en la plantilla.'); onSaved();
    } catch (error) {
      setMessage(error && typeof error === 'object' && 'code' in error && error.code === '23505'
        ? 'Ya existe una prueba activa con ese nombre en el club.' : error instanceof Error ? error.message : backendErrorMessage(error));
    } finally { setBusy(false); }
  }
  return <View style={{ gap: 12, marginTop: 12 }}>
    <Field label="Nueva prueba" value={name} onChangeText={setName} maxLength={64} editable={!busy} />
    <Field label="Teléfono de la prueba (solo capitanes, opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} editable={!busy} />
    <Button label="Añadir prueba" disabled={busy} onPress={() => { void save(); }} />
    {message ? <Message error={failed}>{message}</Message> : null}
  </View>;
}
