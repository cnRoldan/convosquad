import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Message } from '@/components/ui';
import { backendErrorMessage } from '@/lib/backend-result';
import { addCallUpTrial } from './service';

export function CallUpTrialForm({ callUpId, onSaved }: { callUpId: string; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function save() {
    if (busy) return;
    setFailed(true);
    if (!name.trim() || name.trim().length > 64) return setMessage('Introduce un nombre de hasta 64 caracteres.');
    setBusy(true); setMessage('');
    try {
      await addCallUpTrial(callUpId, name.trim(), null);
      setName(''); setFailed(false); setMessage('Prueba añadida a la convocatoria y guardada en la plantilla.'); onSaved();
    } catch (error) {
      setMessage(error && typeof error === 'object' && 'code' in error && error.code === '23505'
        ? 'Ya existe una prueba activa con ese nombre en el club.' : backendErrorMessage(error));
    } finally { setBusy(false); }
  }
  return <View style={{ gap: 12, marginTop: 12 }}>
    <Field label="Nueva prueba" value={name} onChangeText={setName} maxLength={64} editable={!busy} />
    <Button label="Añadir prueba" disabled={busy} onPress={() => { void save(); }} />
    {message ? <Message error={failed}>{message}</Message> : null}
  </View>;
}
