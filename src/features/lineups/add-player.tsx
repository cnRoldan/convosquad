import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Body, Button, Card, Field, Options } from '@/components/ui';
import { t, useLanguage } from '@/features/i18n/runtime';
import { colors } from '@/theme';
import { PlayerToken } from './player-token';
import type { Candidate } from './model';
import type { RosterCategory } from '@/features/players/categories';

export type GuestInput = { kind: 'aid' | 'trial'; name: string; notes: string; phone: string; retain: boolean };
type Filter = 'all' | RosterCategory;
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todos' }, { value: 'attackers', label: 'Delanteros' }, { value: 'midfielders', label: 'Centrocampistas' },
  { value: 'centre_backs', label: 'Defensas' }, { value: 'wide_backs', label: 'Carrileros' }, { value: 'goalkeepers', label: 'Porteros' }, { value: 'backups', label: 'Backups' },
];
export function AddLineupPlayer({ candidates, incidentPlayerIds, playerColor, jerseyColor, select, create, close }: {
  candidates: Candidate[]; incidentPlayerIds?: ReadonlySet<string>; playerColor: string; jerseyColor: string; select: (ids: string[]) => void; create: (input: GuestInput, selectedIds: string[]) => Promise<void>; close: () => void;
}) {
  useLanguage();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selected = selectedIds.filter(id => candidates.some(player => player.id === id));
  const [mode, setMode] = useState<'roster' | 'aid' | 'trial'>('roster');
  const [filter, setFilter] = useState<Filter>('all');
  const [name, setName] = useState(''); const [notes, setNotes] = useState(''); const [phone, setPhone] = useState('');
  const [retain, setRetain] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function add() {
    if (mode === 'roster' || !name.trim()) return;
    setBusy(true); setError('');
    try { await create({ kind: mode, name: name.trim(), notes: notes.trim(), phone: phone.trim(), retain }, selected); close(); }
    catch { setError('No se pudo añadir. Revisa el nombre y el teléfono con prefijo internacional.'); }
    finally { setBusy(false); }
  }
  const visible = filter === 'all' ? candidates : candidates.filter(player => player.category === filter);
  return <Modal transparent onRequestClose={() => { if (!busy) close(); }}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '85%' }}><Card title="Añadir al banquillo">
        {mode === 'roster' ? <><Options value={filter} onChange={setFilter} disabled={busy} options={filters} />
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 4, paddingVertical: 8 }} accessibilityLabel="Elegir jugador para el banquillo">
            {visible.map(player => {
              const checked = selected.includes(player.id);
              return <Pressable accessibilityRole="checkbox" accessibilityLabel={t('Seleccionar {{v0}} para el banquillo', { v0: player.name })} aria-checked={checked} accessibilityState={{ checked, disabled: busy }} disabled={busy} key={player.id}
                onPress={() => setSelectedIds(current => current.includes(player.id) ? current.filter(id => id !== player.id) : [...current, player.id])}
                style={{ opacity: busy ? 0.45 : 1, padding: 4, borderWidth: 1, borderColor: checked ? colors.primary : 'transparent', borderRadius: 12 }}>
                <PlayerToken compact warning={incidentPlayerIds?.has(player.id) ?? false} color={playerColor} jerseyColor={jerseyColor} player={player} />
                {checked ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.background, fontSize: 11, fontWeight: '800' }}>✓</Text></View> : null}
              </Pressable>;
            })}
          </ScrollView>
          {!visible.length ? <Body>No hay jugadores en esta categoría.</Body> : null}
          <Button label={t('Añadir seleccionados ({{v0}})', { v0: selected.length })} disabled={busy || !selected.length} onPress={() => select(selected)} />
        </> : <>
          <Field label="Nombre" value={name} onChangeText={setName} maxLength={64} editable={!busy} />
          <Field label="Notas" value={notes} onChangeText={setNotes} multiline maxLength={1000} editable={!busy} />
          <Field label="WhatsApp (con prefijo internacional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!busy} />
          <Body>¿Incluir en plantilla?</Body><Switch accessibilityLabel="Incluir en plantilla" value={retain} onValueChange={setRetain} disabled={busy} />
          {selected.length ? <Body>{t('También se añadirán los jugadores seleccionados: {{v0}}.', { v0: selected.length })}</Body> : null}
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
