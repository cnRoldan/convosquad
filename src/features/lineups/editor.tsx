import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Body, Button, Card, Heading, Screen } from '@/components/ui';
import { LineupPitch } from './pitch';
import { AddLineupPlayer, type GuestInput } from './add-player';
import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import { loadLineup, saveLineup } from './service';
import { applyPreset, assignPlayer, canPublish, reconcileLineup, sendToBench, type Candidate, type Formation, type Lineup } from './model';

export function LineupEditor({ clubId, callId, captain }: { clubId: string; callId: string; captain: boolean }) {
  const [document, setDocument] = useState<Lineup | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [revision, setRevision] = useState(0);
  const [slot, setSlot] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [active,setActive]=useState(false);
  const [dragging,setDragging]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [conflict,setConflict]=useState(false);
  const editable=captain && active && !busy && !conflict;
  function change(next:Lineup) {setDocument(next);setDirty(true);}
  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const data = await loadLineup(clubId, callId, captain);
      setDocument(data.document); setCandidates(data.candidates); setRevision(data.revision); setMessage('');
      setActive(data.active);setDirty(false);setConflict(false);
    } catch { setMessage('No se pudo cargar el once.'); }
    finally { setBusy(false); }
  }, [clubId, callId, captain]);
  useEffect(() => { const timer=setTimeout(()=>void reload(),0);return ()=>clearTimeout(timer); }, [reload]);
  useEffect(()=>{
    let live=true;
    const timer=setInterval(()=>{
      if(busy||dragging||adding||slot!==null) return;
      void loadLineup(clubId,callId,captain).then(data=>{
        if(!live) return;
        setActive(data.active);setCandidates(data.candidates);
        if(dirty){
          if(data.revision!==revision){setConflict(true);setMessage('Otro capitán ha cambiado el once. Recarga antes de continuar.');}
          else setDocument(current=>current?reconcileLineup(current,data.candidates):current);
        }else{setDocument(data.document);setRevision(data.revision);}
      }).catch(()=>undefined);
    },10000);
    return ()=>{live=false;clearInterval(timer);};
  },[clubId,callId,captain,busy,dragging,adding,slot,dirty,revision]);
  async function save(publish: boolean) {
    if (!document) return;
    setBusy(true);
    try { setRevision(await saveLineup(callId, revision, document, publish)); setDirty(false);setMessage(publish ? 'Once publicado.' : 'Borrador guardado.'); }
    catch (error) {
      setMessage(typeof error === 'object' && error !== null && 'code' in error && error.code === '40001'
        ? 'Otro capitán ha cambiado el once. Recarga antes de continuar.' : 'No se pudo guardar el once.');
    } finally { setBusy(false); }
  }
  function include(id: string) {
    setDocument(d => d ? {...d,bench:[...new Set([...d.bench,id])],manualIds:[...new Set([...(d.manualIds??[]),id])]} : d);setDirty(true); setAdding(false);
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
      {captain ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'] as Formation[]).map(f => <Button key={f} label={f} disabled={!editable} onPress={() => change(applyPreset(document, f))} />)}</View> : null}
      <LineupPitch lineup={document} candidates={candidates} editable={editable} onChange={change} onDragging={setDragging} onSelect={s => setSlot(s.id)} />
      <Card title="Banquillo">{document.bench.map(id => <Body key={id}>{candidates.find(p => p.id === id)?.name ?? id}</Body>)}{captain ? <Button label="+" accessibilityLabel="Añadir al banquillo" disabled={!editable} onPress={()=>setAdding(true)} /> : null}</Card>
      {captain ? <><Button label="Guardar borrador" disabled={!editable} onPress={() => void save(false)} /><Button label="Publicar 11" disabled={!editable || !canPublish(document)} onPress={() => void save(true)} />{!canPublish(document)?<Body>Completa las once posiciones para publicar.</Body>:null}{dirty?<Body>Tienes cambios sin guardar.</Body>:null}</> : null}
    </> : !busy ? <Body>El capitán todavía está preparando el 11.</Body> : null}
    <Button secondary label="Recargar" disabled={busy} onPress={() => void reload()} />
    <Button secondary label="Regresar" onPress={()=>router.replace('/call-up')} />
    {adding && document ? <AddLineupPlayer candidates={candidates.filter(p=>!document.bench.includes(p.id)&&!document.slots.some(s=>s.playerId===p.id))} select={include} create={create} close={()=>setAdding(false)} /> : null}
    <Modal transparent visible={slot !== null} onRequestClose={() => setSlot(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}><ScrollView style={{ maxHeight: '80%' }}><Card title="Cambiar jugador">
        {document && slot !== null ? <>
          {document.slots.find(s=>s.id===slot)?.playerId ? <Button label="Mandar al banquillo" disabled={!editable} onPress={() => { change(sendToBench(document, slot)); setSlot(null); }} />:null}
          {candidates.filter(p => document.bench.includes(p.id) || document.slots.some(s => s.playerId === p.id)).map(p => <Button secondary disabled={!editable} key={p.id} label={p.name} onPress={() => { change(assignPlayer(document, slot, p.id)); setSlot(null); }} />)}
        </> : null}
        <Button label="Cerrar" onPress={() => setSlot(null)} />
      </Card></ScrollView></View>
    </Modal>
  </Screen>;
}
