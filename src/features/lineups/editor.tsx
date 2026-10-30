import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { PlayerToken } from './player-token';
import { router } from 'expo-router';
import { Body, Button, Card, Heading, Screen } from '@/components/ui';
import { IconButton } from '@/components/icon-button';
import { LineupPitch } from './pitch';
import { AddLineupPlayer, type GuestInput } from './add-player';
import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import { deleteLineupPreference, loadLineup, saveLineup, saveLineupPreference } from './service';
import { applyLayout, applyPreset, assignPlayer, canPublish, layoutFromLineup, reconcileLineup, removeFromBench, sendToBench, type Candidate, type Formation, type Lineup, type LineupLayout } from './model';

export function LineupEditor({ clubId, callId, captain }: { clubId: string; callId: string; captain: boolean }) {
  const [document, setDocument] = useState<Lineup | null>(null);
  const [preference, setPreference] = useState<LineupLayout | null>(null);
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
  const editable=captain && active && !busy && !conflict;
  function change(next:Lineup) {setDocument(next);setDirty(true);}
  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const data = await loadLineup(clubId, callId, captain);
      setDocument(data.document); setCandidates(data.candidates); setPreference(data.preference); setRevision(data.revision); setMessage('');
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
        }else{setDocument(data.document);setRevision(data.revision);setPreference(data.preference);setLayoutChanged(false);}
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
      setMessage('Posición personalizada eliminada.');
    } catch { setMessage('No se pudo eliminar la posición personalizada.'); }
    finally { setBusy(false); }
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
        {(['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'] as Formation[]).map(f => <Button key={f} label={f} disabled={!editable} onPress={() => { change(applyPreset(document, f)); setLayoutChanged(false); }} />)}
        {preference ? <><Pressable accessibilityRole="button" accessibilityLabel="Aplicar posición personalizada" disabled={!editable} onPress={() => { change(applyLayout(document, preference)); setLayoutChanged(false); }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#B4F16C', opacity: editable ? 1 : 0.45 }}><Text style={{ color: '#B4F16C', fontWeight: '700' }}>Personalizada</Text></Pressable><IconButton icon="trash" label="Eliminar posición personalizada" danger disabled={!editable} onPress={() => void deleteCustomLayout()} /></> : null}
        <IconButton icon="save" label="Guardar posición personalizada" disabled={!editable || !layoutChanged} onPress={() => void saveCustomLayout()} />
        <IconButton icon="eraser" label="Restaurar posición del preset" disabled={!editable} onPress={() => { change(applyPreset(document, document.formation)); setLayoutChanged(false); }} />
      </View> : null}
      <LineupPitch lineup={document} candidates={candidates} editable={editable} onChange={next => { change(next); setLayoutChanged(true); }} onDragging={setDragging} onSelect={s => setSlot(s.id)} />
      <Card title="Banquillo">
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{gap:4,paddingVertical:8}} accessibilityLabel="Jugadores del banquillo">
          {document.bench.map(id => <Pressable accessibilityRole="button" accessibilityLabel={`Gestionar ${candidates.find(p => p.id === id)?.name ?? 'jugador'} en el banquillo`} disabled={!editable} key={id} onPress={() => setBenchPlayer(id)}><PlayerToken compact player={candidates.find(p => p.id === id)} /></Pressable>)}
          {captain ? <Pressable accessibilityRole="button" accessibilityLabel="Añadir al banquillo" disabled={!editable} onPress={()=>setAdding(true)} style={{opacity:editable?1:0.45}}><PlayerToken compact /></Pressable> : null}
        </ScrollView>
      </Card>
      {captain ? <><Button label="Guardar borrador" disabled={!editable} onPress={() => void save(false)} /><Button label="Publicar 11" disabled={!editable || !canPublish(document)} onPress={() => void save(true)} />{!canPublish(document)?<Body>Completa las once posiciones para publicar.</Body>:null}{dirty?<Body>Tienes cambios sin guardar.</Body>:null}</> : null}
    </> : !busy ? <Body>El capitán todavía está preparando el 11.</Body> : null}
    <Button secondary label="Recargar" disabled={busy} onPress={() => void reload()} />
    <Button secondary label="Regresar" onPress={()=>router.replace('/call-up')} />
    {adding && document ? <AddLineupPlayer candidates={candidates.filter(p=>!document.bench.includes(p.id)&&!document.slots.some(s=>s.playerId===p.id))} select={include} create={create} close={()=>setAdding(false)} /> : null}
    <Modal transparent visible={slot !== null} onRequestClose={() => setSlot(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}><ScrollView style={{ maxHeight: '80%' }}><Card title="Cambiar jugador">
        {document && slot !== null ? <>
          {document.slots.find(s=>s.id===slot)?.playerId ? <Button label="Mandar al banquillo" disabled={!editable} onPress={() => { change(sendToBench(document, slot)); setSlot(null); }} />:null}
          <Body>Banquillo</Body>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 4, paddingVertical: 8 }} accessibilityLabel="Elegir jugador del banquillo">
            {document.bench.map(id => <Pressable accessibilityRole="button" accessibilityLabel={`Elegir ${candidates.find(p => p.id === id)?.name ?? 'jugador'}`} disabled={!editable} key={id} onPress={() => { change(assignPlayer(document, slot, id)); setSlot(null); }}><PlayerToken compact player={candidates.find(p => p.id === id)} /></Pressable>)}
          </ScrollView>
          {document.slots.some(s => s.id !== slot && s.playerId) ? <><Body>Campo</Body><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 4, paddingVertical: 8 }} accessibilityLabel="Intercambiar con jugador del campo">
            {document.slots.filter(s => s.id !== slot && s.playerId).map(s => { const player = candidates.find(p => p.id === s.playerId); return <Pressable accessibilityRole="button" accessibilityLabel={`Intercambiar con ${player?.name ?? 'jugador'}`} disabled={!editable} key={s.id} onPress={() => { if (s.playerId) { change(assignPlayer(document, slot, s.playerId)); setSlot(null); } }}><PlayerToken compact player={player} /></Pressable>; })}
          </ScrollView></> : null}
        </> : null}
        <Button label="Cerrar" onPress={() => setSlot(null)} />
      </Card></ScrollView></View>
    </Modal>
    <Modal transparent visible={benchPlayer !== null} onRequestClose={() => setBenchPlayer(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}><Card title="Jugador en el banquillo">
        {benchPlayer ? <View style={{ alignItems: 'center', paddingVertical: 8 }}><PlayerToken player={candidates.find(p => p.id === benchPlayer)} /></View> : null}
        <Button label="Quitar del banquillo" disabled={!editable} onPress={() => { if (document && benchPlayer) change(removeFromBench(document, benchPlayer)); setBenchPlayer(null); }} />
        <Button secondary label="Cerrar" onPress={() => setBenchPlayer(null)} />
      </Card></View>
    </Modal>
  </Screen>;
}
