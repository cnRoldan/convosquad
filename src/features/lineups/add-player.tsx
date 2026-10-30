import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { Body, Button, Card, Field, Options } from '@/components/ui';
import { PlayerToken } from './player-token';
import type { Candidate } from './model';
import type { RosterCategory } from '@/features/players/categories';

export type GuestInput = { kind: 'aid' | 'trial'; name: string; notes: string; phone: string; retain: boolean };
type Filter = 'all' | RosterCategory;
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todos' }, { value: 'attackers', label: 'Delanteros' }, { value: 'midfielders', label: 'Centrocampistas' },
  { value: 'centre_backs', label: 'Defensas' }, { value: 'wide_backs', label: 'Carrileros' }, { value: 'goalkeepers', label: 'Porteros' }, { value: 'backups', label: 'Backups' },
];
export function AddLineupPlayer({ candidates, playerColor, jerseyColor, select, create, close }: {
  candidates: Candidate[]; playerColor: string; jerseyColor: string; select: (id: string) => void; create: (input: GuestInput) => Promise<void>; close: () => void;
}) {
  const [mode, setMode] = useState<'roster' | 'aid' | 'trial'>('roster');
  const [filter, setFilter] = useState<Filter>('all');
  const [name, setName] = useState(''); const [notes, setNotes] = useState(''); const [phone, setPhone] = useState('');
  const [retain, setRetain] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function add() {
    if (mode === 'roster' || !name.trim()) return;
    setBusy(true); setError('');
    try { await create({ kind: mode, name: name.trim(), notes: notes.trim(), phone: phone.trim(), retain }); close(); }
    catch { setError('No se pudo añadir. Revisa el nombre y el teléfono con prefijo internacional.'); }
    finally { setBusy(false); }
  }
  const visible = filter === 'all' ? candidates : candidates.filter(player => player.category === filter);
  return <Modal transparent onRequestClose={() => { if (!busy) close(); }}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '85%' }}><Card title="Añadir al banquillo">
        {mode === 'roster' ? <><Options value={filter} onChange={setFilter} disabled={busy} options={filters} />
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 4, paddingVertical: 8 }} accessibilityLabel="Elegir jugador para el banquillo">
            {visible.map(player => <Pressable accessibilityRole="button" accessibilityLabel={`Añadir ${player.name} al banquillo`} disabled={busy} key={player.id} onPress={() => select(player.id)} style={{ opacity: busy ? 0.45 : 1 }}><PlayerToken compact color={playerColor} jerseyColor={jerseyColor} player={player} /></Pressable>)}
          </ScrollView>
          {!visible.length ? <Body>No hay jugadores en esta categoría.</Body> : null}
        </> : <>
          <Field label="Nombre" value={name} onChangeText={setName} maxLength={64} editable={!busy} />
          <Field label="Notas" value={notes} onChangeText={setNotes} multiline maxLength={1000} editable={!busy} />
          <Field label="WhatsApp (con prefijo internacional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!busy} />
          <Body>¿Incluir en plantilla?</Body><Switch accessibilityLabel="Incluir en plantilla" value={retain} onValueChange={setRetain} disabled={busy} />
        </>}
        {error ? <Body>{error}</Body> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {mode === 'roster' ? <><Button label="Añadir ayuda" disabled={busy} onPress={() => { setError(''); setMode('aid'); }} /><Button label="Añadir prueba" disabled={busy} onPress={() => { setError(''); setMode('trial'); }} /></> : <><Button label={mode === 'aid' ? 'Añadir ayuda' : 'Añadir prueba'} disabled={busy || !name.trim()} onPress={() => void add()} /><Button secondary label="Volver" disabled={busy} onPress={() => setMode('roster')} /></>}
          <Button secondary label="Cerrar" disabled={busy} onPress={close} />
        </View>
      </Card></ScrollView>
    </View>
  </Modal>;
}
