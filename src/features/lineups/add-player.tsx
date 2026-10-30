import { useState } from 'react';
import { Modal, ScrollView, Switch, View } from 'react-native';
import { Body, Button, Card, Field, Options } from '@/components/ui';
import type { Candidate } from './model';

export type GuestInput = { kind: 'aid' | 'trial'; name: string; notes: string; phone: string; retain: boolean };
export function AddLineupPlayer({ candidates, select, create, close }: {
  candidates: Candidate[]; select: (id: string) => void; create: (input: GuestInput) => Promise<void>; close: () => void;
}) {
  const [tab, setTab] = useState<'roster' | 'aid' | 'trial'>('roster');
  const [name, setName] = useState(''); const [notes, setNotes] = useState(''); const [phone, setPhone] = useState('');
  const [retain, setRetain] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function add() {
    if (tab === 'roster' || !name.trim()) return;
    setBusy(true); setError('');
    try { await create({ kind: tab, name: name.trim(), notes: notes.trim(), phone: phone.trim(), retain }); close(); }
    catch { setError('No se pudo añadir. Revisa el nombre y el teléfono con prefijo internacional.'); }
    finally { setBusy(false); }
  }
  return <Modal transparent onRequestClose={() => { if (!busy) close(); }}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '85%' }}><Card title="Añadir al banquillo">
        <Options value={tab} onChange={setTab} disabled={busy} options={[{ value: 'roster', label: 'Jugador registrado en plantilla' }, { value: 'aid', label: 'Ayuda' }, { value: 'trial', label: 'Prueba' }]} />
        {tab === 'roster' ? <>{candidates.map(p => <Button secondary key={p.id} label={p.name} onPress={() => select(p.id)} />)}{!candidates.length ? <Body>No quedan jugadores por añadir.</Body> : null}</> : <>
          <Field label="Nombre" value={name} onChangeText={setName} maxLength={64} editable={!busy} />
          <Field label="Notas" value={notes} onChangeText={setNotes} multiline maxLength={1000} editable={!busy} />
          <Field label="WhatsApp (con prefijo internacional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!busy} />
          <Body>¿Incluir en plantilla?</Body><Switch accessibilityLabel="Incluir en plantilla" value={retain} onValueChange={setRetain} disabled={busy} />
          <Button label="Añadir" disabled={busy || !name.trim()} onPress={() => void add()} />
        </>}
        {error ? <Body>{error}</Body> : null}
        <Button secondary label="Cerrar" disabled={busy} onPress={close} />
      </Card></ScrollView>
    </View>
  </Modal>;
}
