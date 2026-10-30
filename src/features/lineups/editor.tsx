import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { PlayerToken } from './player-token';
import { router } from 'expo-router';
import { Body, Button, Card, Field, Heading, Screen } from '@/components/ui';
import { IconButton } from '@/components/icon-button';
import { colors } from '@/theme';
import ColorPicker, { HueSlider, Panel1, Preview } from 'reanimated-color-picker';
import { ClubCrest } from '@/features/clubs/club-crest';
import { LineupPitch } from './pitch';
import { AddLineupPlayer, type GuestInput } from './add-player';
import { shareLineupImage } from './share-image';
import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import { deleteLineupPreference, loadLineup, saveLineup, saveLineupPreference, setLineupPlayerColors } from './service';
import { applyLayout, applyPreset, assignPlayer, canPublish, layoutFromLineup, reconcileLineup, removeFromBench, sendToBench, type Candidate, type Formation, type Lineup, type LineupLayout } from './model';

type SelectedPreset = Formation | 'custom' | null;

export function LineupEditor({ clubId, clubName, crestPath, callId, captain }: { clubId: string; clubName: string; crestPath?: string | null | undefined; callId: string; captain: boolean }) {
  const [document, setDocument] = useState<Lineup | null>(null);
  const [preference, setPreference] = useState<LineupLayout | null>(null);
  const [playerColor, setPlayerColor] = useState('#B4F16C');
  const [jerseyColor, setJerseyColor] = useState('#0B1210');
  const [selectedPreset, setSelectedPreset] = useState<SelectedPreset>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [revision, setRevision] = useState(0);
  const [slot, setSlot] = useState<number | null>(null);
  const [benchPlayer, setBenchPlayer] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [active,setActive]=useState(false);
  const [dragging,setDragging]=useState(false);
  const [layoutChanged,setLayoutChanged]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [conflict,setConflict]=useState(false);
  const [sharing,setSharing]=useState(false);
  const [colorPicker,setColorPicker]=useState(false);
  const [customColor,setCustomColor]=useState('#B4F16C');
  const [customJerseyColor,setCustomJerseyColor]=useState('#0B1210');
  const shareImageRef = useRef<View>(null);
  const editable=captain && active && !busy && !conflict;
  function change(next:Lineup) {setDocument(next);setDirty(true);}
  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const data = await loadLineup(clubId, callId, captain);
      setDocument(data.document); setCandidates(data.candidates); setPreference(data.preference); setPlayerColor(data.playerColor); setJerseyColor(data.jerseyColor); setSelectedPreset(presetFor(data.document, data.preference)); setRevision(data.revision); setMessage('');
      setActive(data.active);setDirty(false);setLayoutChanged(false);setConflict(false);
    } catch { setMessage('No se pudo cargar el once.'); }
    finally { setBusy(false); }
  }, [clubId, callId, captain]);
  useEffect(() => { const timer=setTimeout(()=>void reload(),0);return ()=>clearTimeout(timer); }, [reload]);
  useEffect(()=>{
    let live=true;
    const timer=setInterval(()=>{
      if(busy||dragging||adding||slot!==null||benchPlayer!==null) return;
      void loadLineup(clubId,callId,captain).then(data=>{
        if(!live) return;
        setActive(data.active);setCandidates(data.candidates);
        if(dirty){
          if(data.revision!==revision){setConflict(true);setMessage('Otro capitán ha cambiado el once. Recarga antes de continuar.');}
          else setDocument(current=>current?reconcileLineup(current,data.candidates):current);
        }else{setDocument(data.document);setRevision(data.revision);setPreference(data.preference);setPlayerColor(data.playerColor);setJerseyColor(data.jerseyColor);setSelectedPreset(presetFor(data.document,data.preference));setLayoutChanged(false);}
      }).catch(()=>undefined);
    },10000);
    return ()=>{live=false;clearInterval(timer);};
  },[clubId,callId,captain,busy,dragging,adding,slot,benchPlayer,dirty,revision]);
  async function save(publish: boolean) {
    if (!document) return;
    setBusy(true);
    try { setRevision(await saveLineup(callId, revision, document, publish)); setDirty(false);setMessage(publish ? 'Once publicado.' : 'Borrador guardado.'); }
    catch (error) {
      setMessage(typeof error === 'object' && error !== null && 'code' in error && error.code === '40001'
        ? 'Otro capitán ha cambiado el once. Recarga antes de continuar.' : 'No se pudo guardar el once.');
    } finally { setBusy(false); }
  }
  async function saveCustomLayout() {
    if (!document) return;
    setBusy(true);
    try {
      setPreference(await saveLineupPreference(clubId, layoutFromLineup(document)));
      setSelectedPreset('custom');
      setLayoutChanged(false);
      setMessage('Posición personalizada guardada para los capitanes del club.');
    } catch { setMessage('No se pudo guardar la posición personalizada.'); }
    finally { setBusy(false); }
  }
  async function deleteCustomLayout() {
    setBusy(true);
    try {
      await deleteLineupPreference(clubId);
      setPreference(null);
      if (selectedPreset === 'custom') setSelectedPreset(null);
      setMessage('Posición personalizada eliminada.');
    } catch { setMessage('No se pudo eliminar la posición personalizada.'); }
    finally { setBusy(false); }
  }
  async function saveColors() {
    const player = normalizeHex(customColor), jersey = normalizeHex(customJerseyColor);
    if (!player || !jersey) { setMessage('Introduce colores hexadecimales válidos, por ejemplo #B4F16C.'); return; }
    if (player === playerColor && jersey === jerseyColor) { setColorPicker(false); return; }
    setBusy(true);
    try { const result = await setLineupPlayerColors(clubId, player, jersey); setPlayerColor(result.playerColor); setJerseyColor(result.jerseyColor); setCustomColor(result.playerColor); setCustomJerseyColor(result.jerseyColor); setColorPicker(false); setMessage('Colores de los jugadores guardados.'); }
    catch { setMessage('No se pudieron guardar los colores de los jugadores.'); }
    finally { setBusy(false); }
  }
  async function shareImage() {
    setSharing(true); setMessage('');
    try { await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); await shareLineupImage(shareImageRef); }
    catch { setMessage('No se pudo generar la imagen. Inténtalo de nuevo.'); }
    finally { setSharing(false); }
  }
  function include(id: string) {
    setDocument(d => d ? {...d,bench:[...new Set([...d.bench,id])],manualIds:[...new Set([...(d.manualIds??[]),id])],excludedIds:d.excludedIds?.filter(excludedId=>excludedId!==id)} : d);setDirty(true); setAdding(false);
  }
  async function create(input: GuestInput) {
    const id=unwrap(await requireSupabase().rpc('add_lineup_guest',{p_call_id:callId,p_kind:input.kind,p_name:input.name,p_notes:input.notes,p_phone:input.phone,p_retain:input.retain}));
    setCandidates(current=>[...current,{id,name:input.name,active:true,eligible:false,manual:true}]);include(id);
  }
  return <Screen scrollEnabled={!dragging}>
    <Heading title="Tu 11" />
    {message ? <Body>{message}</Body> : null}
    {busy ? <Body>Cargando…</Body> : null}
    {document ? <>
      {captain ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {(['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'] as Formation[]).map(f => <PresetChip key={f} label={f} selected={selectedPreset === f} disabled={!editable} onPress={() => { change(applyPreset(document, f)); setSelectedPreset(f); setLayoutChanged(false); }} />)}
        {preference ? <><PresetChip label="Personalizada" selected={selectedPreset === 'custom'} disabled={!editable} onPress={() => { change(applyLayout(document, preference)); setSelectedPreset('custom'); setLayoutChanged(false); }} /><IconButton icon="trash" label="Eliminar posición personalizada" danger disabled={!editable} onPress={() => void deleteCustomLayout()} /></> : null}
        <IconButton icon="save" label="Guardar posición personalizada" disabled={!editable || !layoutChanged} onPress={() => void saveCustomLayout()} />
        <IconButton icon="eraser" label="Restaurar posición del preset" disabled={!editable} onPress={() => { change(resetPreset(document, selectedPreset, preference)); setLayoutChanged(false); }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Configurar colores de jugadores" disabled={!editable} onPress={() => { setCustomColor(playerColor); setCustomJerseyColor(jerseyColor); setColorPicker(true); }} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: playerColor, borderWidth: 3, borderColor: jerseyColor, opacity: editable ? 1 : 0.45 }} />
      </View> : null}
      <View ref={shareImageRef} collapsable={false} style={sharing ? { backgroundColor: '#0B1210', padding: 16, gap: 12 } : undefined}>
        {sharing ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><ClubCrest path={crestPath} name={clubName} size={38} /><Text numberOfLines={1} style={{ flex: 1, color: '#F3F8F1', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 }}>{clubName}</Text></View> : null}
        <LineupPitch playerColor={playerColor} jerseyColor={jerseyColor} lineup={document} candidates={candidates} editable={editable} onChange={next => { change(next); setSelectedPreset(null); setLayoutChanged(true); }} onDragging={setDragging} onSelect={s => setSlot(s.id)} />
        {sharing ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={{ color: '#B7C7B9', fontSize: 9, fontWeight: '700' }}>Powered by</Text><Image source={require('../../../assets/images/icon.png')} style={{ width: 15, height: 15, borderRadius: 4 }} /><Text style={{ color: '#F3F8F1', fontSize: 10, fontWeight: '800' }}>ConvoSquad</Text></View> : null}
      </View>
      <Button label={sharing ? 'Generando imagen…' : 'Generar imagen'} disabled={sharing} onPress={() => void shareImage()} />
      <Card title="Banquillo">
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{gap:4,paddingVertical:8}} accessibilityLabel="Jugadores del banquillo">
          {document.bench.map(id => <Pressable accessibilityRole="button" accessibilityLabel={`Gestionar ${candidates.find(p => p.id === id)?.name ?? 'jugador'} en el banquillo`} disabled={!editable} key={id} onPress={() => setBenchPlayer(id)}><PlayerToken compact color={playerColor} jerseyColor={jerseyColor} player={candidates.find(p => p.id === id)} /></Pressable>)}
          {captain ? <Pressable accessibilityRole="button" accessibilityLabel="Añadir al banquillo" disabled={!editable} onPress={()=>setAdding(true)} style={{opacity:editable?1:0.45}}><PlayerToken compact /></Pressable> : null}
        </ScrollView>
      </Card>
      {captain ? <><Button label="Guardar borrador" disabled={!editable} onPress={() => void save(false)} /><Button label="Publicar 11" disabled={!editable || !canPublish(document)} onPress={() => void save(true)} />{!canPublish(document)?<Body>Completa las once posiciones para publicar.</Body>:null}{dirty?<Body>Tienes cambios sin guardar.</Body>:null}</> : null}
    </> : !busy ? <Body>El capitán todavía está preparando el 11.</Body> : null}
    <Button secondary label="Recargar" disabled={busy} onPress={() => void reload()} />
    <Button secondary label="Regresar" onPress={()=>router.replace('/call-up')} />
    {adding && document ? <AddLineupPlayer playerColor={playerColor} jerseyColor={jerseyColor} candidates={candidates.filter(p=>!document.bench.includes(p.id)&&!document.slots.some(s=>s.playerId===p.id))} select={include} create={create} close={()=>setAdding(false)} /> : null}
    <Modal transparent visible={slot !== null} onRequestClose={() => setSlot(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}><ScrollView style={{ maxHeight: '80%' }}><Card title="Cambiar jugador">
        {document && slot !== null ? <>
          {document.slots.find(s=>s.id===slot)?.playerId ? <Button label="Mandar al banquillo" disabled={!editable} onPress={() => { change(sendToBench(document, slot)); setSlot(null); }} />:null}
          <Body>Banquillo</Body>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 4, paddingVertical: 8 }} accessibilityLabel="Elegir jugador del banquillo">
            {document.bench.map(id => <Pressable accessibilityRole="button" accessibilityLabel={`Elegir ${candidates.find(p => p.id === id)?.name ?? 'jugador'}`} disabled={!editable} key={id} onPress={() => { change(assignPlayer(document, slot, id)); setSlot(null); }}><PlayerToken compact color={playerColor} jerseyColor={jerseyColor} player={candidates.find(p => p.id === id)} /></Pressable>)}
          </ScrollView>
          {document.slots.some(s => s.id !== slot && s.playerId) ? <><Body>Campo</Body><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 4, paddingVertical: 8 }} accessibilityLabel="Intercambiar con jugador del campo">
            {document.slots.filter(s => s.id !== slot && s.playerId).map(s => { const player = candidates.find(p => p.id === s.playerId); return <Pressable accessibilityRole="button" accessibilityLabel={`Intercambiar con ${player?.name ?? 'jugador'}`} disabled={!editable} key={s.id} onPress={() => { if (s.playerId) { change(assignPlayer(document, slot, s.playerId)); setSlot(null); } }}><PlayerToken compact color={playerColor} jerseyColor={jerseyColor} player={player} /></Pressable>; })}
          </ScrollView></> : null}
        </> : null}
        <Button label="Cerrar" onPress={() => setSlot(null)} />
      </Card></ScrollView></View>
    </Modal>
    <Modal transparent visible={benchPlayer !== null} onRequestClose={() => setBenchPlayer(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}><Card title="Jugador en el banquillo">
        {benchPlayer ? <View style={{ alignItems: 'center', paddingVertical: 8 }}><PlayerToken color={playerColor} jerseyColor={jerseyColor} player={candidates.find(p => p.id === benchPlayer)} /></View> : null}
        <Button label="Quitar del banquillo" disabled={!editable} onPress={() => { if (document && benchPlayer) change(removeFromBench(document, benchPlayer)); setBenchPlayer(null); }} />
        <Button secondary label="Cerrar" onPress={() => setBenchPlayer(null)} />
      </Card></View>
    </Modal>
    <Modal transparent visible={colorPicker} onRequestClose={() => setColorPicker(false)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}><Card title="Color personalizado">
        <Body>Elige ambos tonos visualmente o escribe sus códigos hexadecimales.</Body>
        <ColorPicker value={customColor} onChangeJS={result => setCustomColor(result.hex)} style={{ gap: 12 }} sliderThickness={22} thumbSize={24} thumbColor={colors.text}>
          <Panel1 style={{ height: 190, borderRadius: 14 }} />
          <HueSlider style={{ borderRadius: 12 }} />
          <Preview hideInitialColor style={{ borderRadius: 12 }} />
        </ColorPicker>
        <Field label="Color hexadecimal" value={customColor} onChangeText={setCustomColor} autoCapitalize="characters" maxLength={7} editable={!busy} />
        <Field label="Color de dorsales" value={customJerseyColor} onChangeText={setCustomJerseyColor} autoCapitalize="characters" maxLength={7} editable={!busy} />
        <Button label="Aplicar colores" disabled={busy || !normalizeHex(customColor) || !normalizeHex(customJerseyColor)} onPress={() => void saveColors()} />
        <Button secondary label="Cerrar" onPress={() => setColorPicker(false)} />
      </Card></View>
    </Modal>
  </Screen>;
}

function normalizeHex(value: string) {
  const color = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color.toUpperCase() : null;
}

function PresetChip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Formación ${label}`} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface, opacity: disabled ? 0.45 : 1 }}><Text style={{ color: selected ? colors.background : colors.text, fontWeight: '700' }}>{label}</Text></Pressable>;
}

function presetFor(document: Lineup | null, preference: LineupLayout | null): SelectedPreset {
  if (!document) return null;
  if (preference && document.formation === preference.formation && document.slots.every(slot => preference.slots.some(saved => saved.id === slot.id && saved.x === slot.x && saved.y === slot.y))) return 'custom';
  return document.formation;
}

function resetPreset(document: Lineup, selected: SelectedPreset, preference: LineupLayout | null): Lineup {
  if (selected === 'custom' && preference) return applyLayout(document, preference);
  return applyPreset(document, selected && selected !== 'custom' ? selected : document.formation);
}
