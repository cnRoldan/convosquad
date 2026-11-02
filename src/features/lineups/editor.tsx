import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { PlayerToken } from './player-token';
import { Body, Button, Card, Field, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { IconButton } from '@/components/icon-button';
import { colors } from '@/theme';
import ColorPicker, { HueSlider, Panel1, Preview } from 'reanimated-color-picker';
import { LineupShareCard } from './share-card';
import { getClubCrestUrl } from '@/features/clubs/crest';
import { getClubSettings, listClubMembers } from '@/features/clubs/service';
import { LineupPitch } from './pitch';
import { AddLineupPlayer, type GuestInput } from './add-player';
import { shareLineupImage } from './share-image';
import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import { deleteLineupDraft, deleteLineupPreference, listLineupDrafts, loadLineup, publishLineupDraft, saveLineupDraft, saveLineupPreference, setLineupPlayerColors, setLineupPositionLock, voteLineupDraft, type LineupDraft } from './service';
import { applyLayout, applyPreset, assignPlayer, canPublish, layoutFromLineup, reconcileLineup, removeFromBench, sendToBench, type Candidate, type Formation, type Lineup, type LineupLayout } from './model';

type SelectedPreset = Formation | 'custom' | null;
const historyLimit = 50;

export function LineupEditor({ clubId, clubName, crestPath, callId, captain, initialDraftId }: { clubId: string; clubName: string; crestPath?: string | null | undefined; callId: string; captain: boolean; initialDraftId?: string }) {
  const [document, setDocument] = useState<Lineup | null>(null);
  const [preference, setPreference] = useState<LineupLayout | null>(null);
  const [playerColor, setPlayerColor] = useState('#B4F16C');
  const [jerseyColor, setJerseyColor] = useState('#0B1210');
  const [selectedPreset, setSelectedPreset] = useState<SelectedPreset>(null);
  const [history, setHistory] = useState<Lineup[]>([]);
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
  const [positionLocked,setPositionLocked]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [conflict,setConflict]=useState(false);
  const [sharing,setSharing]=useState(false);
  const [drafts,setDrafts]=useState<LineupDraft[]>([]);
  const [activeDraftId,setActiveDraftId]=useState<string | null>(null);
  const [draftMode,setDraftMode]=useState<'save'|'send'|'suggest'|null>(null);
  const [draftTitle,setDraftTitle]=useState('');
  const [confirmPublish,setConfirmPublish]=useState(false);
  const [confirmDeleteDraft,setConfirmDeleteDraft]=useState(false);
  const [published,setPublished]=useState(false);
  const [captainCount,setCaptainCount]=useState(1);
  const [colorPicker,setColorPicker]=useState(false);
  const [editingColor,setEditingColor]=useState<'shirt' | 'jersey'>('shirt');
  const [customColor,setCustomColor]=useState('#B4F16C');
  const [customJerseyColor,setCustomJerseyColor]=useState('#0B1210');
  const shareImageRef = useRef<View>(null);
  const [shareCrestUrl, setShareCrestUrl] = useState<string | null>(null);
  const editable=captain && active && !busy && !conflict;
  function change(next: Lineup, remember = true) {
    if (remember && document) setHistory(current => [...current, document].slice(-historyLimit));
    setDocument(next);
    setDirty(true);
  }
  function beginDrag() {
    if (document) setHistory(current => [...current, document].slice(-historyLimit));
  }
  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setDocument(previous);
    setHistory(current => current.slice(0, -1));
    setDirty(true);
    setSelectedPreset(null);
    setLayoutChanged(true);
  }
  const activeDraft = drafts.find(draft => draft.id === activeDraftId) ?? null;
  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const [data, rows] = await Promise.all([loadLineup(clubId, callId, captain), captain ? listLineupDrafts(callId) : Promise.resolve([])]);
      const requested = initialDraftId ? rows.find(draft => draft.id === initialDraftId) : null;
      const loadedDocument = requested?.document ?? data.document;
      const preset = presetFor(loadedDocument, data.preference);
      setDocument(loadedDocument); setHistory([]); setCandidates(data.candidates); setPreference(data.preference); setPlayerColor(data.playerColor); setJerseyColor(data.jerseyColor); setSelectedPreset(preset); setRevision(data.revision); setMessage('');
      setActive(data.active);setPositionLocked(data.positionLocked);setDirty(false);setLayoutChanged(false);setConflict(false);
      setDrafts(rows); if (requested) setActiveDraftId(requested.id);
    } catch { setMessage('No se pudo cargar el once.'); }
    finally { setBusy(false); }
  }, [clubId, callId, captain, initialDraftId]);
  useEffect(() => { const timer=setTimeout(()=>void reload(),0);return ()=>clearTimeout(timer); }, [reload]);
  useEffect(() => { void listClubMembers(clubId).then(rows => setCaptainCount(rows.filter(row => row.role === 'admin' && row.is_active).length)).catch(() => undefined); }, [clubId]);
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
        }else{const preset=presetFor(data.document,data.preference);setDocument(data.document);setHistory([]);setRevision(data.revision);setPreference(data.preference);setPlayerColor(data.playerColor);setJerseyColor(data.jerseyColor);setPositionLocked(data.positionLocked);setSelectedPreset(preset);setLayoutChanged(false);}
      }).catch(()=>undefined);
    },10000);
    return ()=>{live=false;clearInterval(timer);};
  },[clubId,callId,captain,busy,dragging,adding,slot,benchPlayer,dirty,revision]);
  function openDraft(mode: 'save' | 'send' | 'suggest') { setDraftMode(mode); setDraftTitle(mode === 'send' && (!activeDraft || activeDraft.submittedAt) ? `Borrador #${drafts.length + 1}` : activeDraft?.title ?? `Borrador #${drafts.length + 1}`); }
  async function saveDraft() {
    if (!document || !draftMode || !draftTitle.trim()) return;
    const mode = draftMode;
    const sendsExisting = mode === 'send' && Boolean(activeDraft && !activeDraft.submittedAt);
    if (mode === 'send' && !sendsExisting && drafts.some(draft => draft.title.trim().toLocaleLowerCase() === draftTitle.trim().toLocaleLowerCase())) { setMessage('Ya existe un borrador con ese nombre.'); return; }
    setBusy(true);
    try { const saved = await saveLineupDraft(callId, mode === 'send' && !sendsExisting ? null : activeDraft, draftTitle.trim(), document, mode !== 'save', mode === 'suggest' && activeDraft ? countLineupChanges(activeDraft.document, document) : 0); setActiveDraftId(saved.id); setDraftMode(null); setDirty(false); await reload(); setMessage(mode === 'send' ? (sendsExisting ? 'Borrador enviado para valoración.' : 'Nuevo borrador enviado para valoración.') : mode === 'suggest' ? 'Cambios enviados a valoración.' : 'Borrador guardado.'); }
    catch { setMessage('No se pudo guardar el borrador.'); }
    finally { setBusy(false); }
  }
  async function vote(approved: boolean) { if (!activeDraft) return; setBusy(true); try { await voteLineupDraft(activeDraft.id, approved); await reload(); } catch { setMessage('No se pudo registrar la valoración.'); } finally { setBusy(false); } }
  async function removeDraft() { if (!activeDraft) return; setBusy(true); try { await deleteLineupDraft(activeDraft.id); setActiveDraftId(null); setConfirmDeleteDraft(false); await reload(); setMessage('Borrador eliminado.'); } catch { setMessage('No se pudo eliminar el borrador.'); } finally { setBusy(false); } }
  async function publishDraft() { if (!document) return; setBusy(true); try { const saved = !activeDraft || dirty ? await saveLineupDraft(callId, activeDraft, activeDraft?.title ?? `Borrador #${drafts.length + 1}`, document) : activeDraft; await publishLineupDraft(saved.id); setActiveDraftId(saved.id); setPublished(true); setDirty(false); setConfirmPublish(false); await reload(); setMessage('Once publicado.'); } catch { setMessage('No se pudo publicar el once.'); } finally { setBusy(false); } }
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
  async function togglePositionLock() {
    setBusy(true);
    try { setPositionLocked(await setLineupPositionLock(clubId, !positionLocked)); }
    catch { setMessage('No se pudo guardar el candado de posiciones.'); }
    finally { setBusy(false); }
  }
  async function shareImage() {
    setSharing(true); setMessage('');
    try {
      const club = await getClubSettings(clubId);
      const currentCrestPath = club.crest_path ?? crestPath;
      let embeddedCrest: string | null = null;
      if (currentCrestPath) {
        const response = await fetch(await getClubCrestUrl(currentCrestPath));
        if (!response.ok) throw new Error('No se pudo cargar el escudo.');
        const blob = await response.blob();
        embeddedCrest = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('No se pudo preparar el escudo.'));
          reader.readAsDataURL(blob);
        });
      }
      setShareCrestUrl(embeddedCrest);
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await shareLineupImage(shareImageRef);
    }
    catch { setMessage('No se pudo generar la imagen. Inténtalo de nuevo.'); }
    finally { setSharing(false); }
  }
  function include(id: string) {
    if (document) change({...document,bench:[...new Set([...document.bench,id])],manualIds:[...new Set([...(document.manualIds??[]),id])],excludedIds:document.excludedIds?.filter(excludedId=>excludedId!==id)});
    setAdding(false);
  }
  async function create(input: GuestInput) {
    const id=unwrap(await requireSupabase().rpc('add_lineup_guest',{p_call_id:callId,p_kind:input.kind,p_name:input.name,p_notes:input.notes,p_phone:input.phone,p_retain:input.retain}));
    setCandidates(current=>[...current,{id,name:input.name,active:true,eligible:false,manual:true}]);include(id);
  }
  return <Screen scrollEnabled={!dragging} onRefresh={() => void reload()} refreshing={busy}>
    {message ? <Body>{message}</Body> : null}
    {busy ? <Body>Cargando…</Body> : null}
    {document ? <>
      {captain ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {(['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'] as Formation[]).map(f => <PresetChip key={f} label={f} selected={selectedPreset === f} disabled={!editable} onPress={() => { change(applyPreset(document, f)); setSelectedPreset(f); setLayoutChanged(false); }} />)}
        {preference ? <><PresetChip label="Personalizada" selected={selectedPreset === 'custom'} disabled={!editable} onPress={() => { change(applyLayout(document, preference)); setSelectedPreset('custom'); setLayoutChanged(false); }} /><IconButton icon="trash" label="Eliminar posición personalizada" danger disabled={!editable} onPress={() => void deleteCustomLayout()} /></> : null}
        <IconButton icon="save" label="Guardar posición personalizada" disabled={!editable || !layoutChanged} onPress={() => void saveCustomLayout()} />
        <IconButton icon="undo" label="Deshacer último cambio" disabled={!editable || history.length === 0 || dragging} onPress={undo} />
        <Pressable accessibilityRole="button" accessibilityLabel="Configurar colores de jugadores" disabled={!editable} onPress={() => { setCustomColor(playerColor); setCustomJerseyColor(jerseyColor); setEditingColor('shirt'); setColorPicker(true); }} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: playerColor, borderWidth: 3, borderColor: jerseyColor, opacity: editable ? 1 : 0.45 }} />
      </View> : null}
      {captain && drafts.length ? <><Text style={{ color: colors.muted, fontSize: 18, fontWeight: '600' }}>Revisa tus borradores</Text><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 6, paddingTop: 9, paddingRight: 9 }}><PresetChip label="Sin borrador" selected={!activeDraftId} disabled={!editable} onPress={() => setActiveDraftId(null)} />{drafts.map(draft => <PresetChip key={draft.id} label={draft.title} selected={activeDraftId === draft.id} published={draft.published} disabled={!editable} onPress={() => { setActiveDraftId(draft.id); setDocument(draft.document); setHistory([]); setDirty(false); setLayoutChanged(false); }} />)}</ScrollView></> : null}
      {captain && activeDraft ? <Card title={`${activeDraft.title} · revisión ${activeDraft.revision}`}>{activeDraft.published ? <><Body>Creado por: {activeDraft.createdBy}</Body><Body>Publicado por: {activeDraft.publishedBy ?? activeDraft.updatedBy}</Body></> : <Body>Modificado por: {activeDraft.updatedBy}</Body>}{activeDraft.suggestedBy && activeDraft.suggestedChanges > 0 ? <Body>{activeDraft.suggestedBy} ha sugerido {activeDraft.suggestedChanges} {activeDraft.suggestedChanges === 1 ? 'cambio' : 'cambios'}.</Body> : null}{!activeDraft.submittedAt ? <Body>Este borrador todavía no se ha enviado a valoración.</Body> : null}<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{activeDraft.submittedAt ? <View style={{ flexDirection: 'row', gap: 8 }}><Button label={`👍 ${activeDraft.upVotes}`} disabled={busy} onPress={() => void vote(true)} /><Button secondary label={`👎 ${activeDraft.downVotes}`} disabled={busy} onPress={() => void vote(false)} /></View> : null}<IconButton icon="trash" label="Eliminar borrador" danger size={52} disabled={busy} onPress={() => setConfirmDeleteDraft(true)} /></View></Card> : null}
      <View ref={shareImageRef} collapsable={false} style={sharing ? { backgroundColor: '#0B1210', padding: 16, gap: 12 } : undefined}>
        {sharing ? <LineupShareCard clubName={clubName} crestUrl={shareCrestUrl} lineup={document} candidates={candidates} shirtColor={playerColor} numberColor={jerseyColor} /> : <LineupPitch playerColor={playerColor} jerseyColor={jerseyColor} positionLocked={positionLocked} onTogglePositionLock={editable ? () => void togglePositionLock() : undefined} lineup={document} candidates={candidates} editable={editable} onDragStart={beginDrag} onChange={next => { change(next, false); setSelectedPreset(null); setLayoutChanged(true); }} onDragging={setDragging} onSelect={s => setSlot(s.id)} />}
      </View>
      <Card title="Banquillo">
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{gap:4,paddingVertical:8}} accessibilityLabel="Jugadores del banquillo">
          {document.bench.map(id => <Pressable accessibilityRole="button" accessibilityLabel={`Gestionar ${candidates.find(p => p.id === id)?.name ?? 'jugador'} en el banquillo`} disabled={!editable} key={id} onPress={() => setBenchPlayer(id)}><PlayerToken compact color={playerColor} jerseyColor={jerseyColor} player={candidates.find(p => p.id === id)} /></Pressable>)}
          {captain ? <Pressable accessibilityRole="button" accessibilityLabel="Añadir al banquillo" disabled={!editable} onPress={()=>setAdding(true)} style={{opacity:editable?1:0.45}}><PlayerToken compact /></Pressable> : null}
        </ScrollView>
      </Card>
      {captain ? <><Button label={activeDraft?.submittedAt ? "Sugerir cambios" : "Guardar borrador"} disabled={!editable || Boolean(activeDraft?.submittedAt && !dirty)} onPress={() => openDraft(activeDraft?.submittedAt ? 'suggest' : 'save')} />{captainCount > 1 ? <Button label="Enviar para valoración" disabled={!editable || (!dirty && (!activeDraft || Boolean(activeDraft.submittedAt)))} onPress={() => openDraft('send')} /> : null}<Button label={activeDraft?.published ? "Republicar 11" : "Publicar 11"} disabled={!editable || !canPublish(document) || Boolean(activeDraft?.published && !dirty)} onPress={() => setConfirmPublish(true)} />{!canPublish(document)?<Body>Completa las once posiciones para publicar.</Body>:null}{dirty?<Body>Tienes cambios sin guardar.</Body>:null}</> : null}
    </> : !busy ? <Body>El capitán todavía está preparando el 11.</Body> : null}
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
        <Body>Selecciona primero el color que quieres editar y elígelo visualmente.</Body>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: editingColor === 'shirt' }} onPress={() => setEditingColor('shirt')} style={{ flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 12, borderWidth: 2, borderColor: editingColor === 'shirt' ? colors.primary : colors.border, backgroundColor: customColor }}><Text style={{ color: customJerseyColor, fontWeight: '800', textAlign: 'center' }}>Camiseta</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: editingColor === 'jersey' }} onPress={() => setEditingColor('jersey')} style={{ flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 12, borderWidth: 2, borderColor: editingColor === 'jersey' ? colors.primary : colors.border, backgroundColor: customJerseyColor }}><Text style={{ color: customColor, fontWeight: '800', textAlign: 'center' }}>Dorsales</Text></Pressable>
        </View>
        <ColorPicker key={editingColor} value={editingColor === 'shirt' ? customColor : customJerseyColor} onChangeJS={result => { if (editingColor === 'shirt') setCustomColor(result.hex); else setCustomJerseyColor(result.hex); }} style={{ gap: 12 }} sliderThickness={22} thumbSize={24} thumbColor={colors.text}>
          <Panel1 style={{ height: 190, borderRadius: 14 }} />
          <HueSlider style={{ borderRadius: 12 }} />
          <Preview hideInitialColor style={{ borderRadius: 12 }} />
        </ColorPicker>
        <Field label="Color de la camiseta" value={customColor} onChangeText={setCustomColor} autoCapitalize="characters" maxLength={7} editable={!busy} />
        <Field label="Color de dorsales" value={customJerseyColor} onChangeText={setCustomJerseyColor} autoCapitalize="characters" maxLength={7} editable={!busy} />
        <Button label="Aplicar colores" disabled={busy || !normalizeHex(customColor) || !normalizeHex(customJerseyColor)} onPress={() => void saveColors()} />
        <Button secondary label="Cerrar" onPress={() => setColorPicker(false)} />
      </Card></View>
    </Modal>
    <Modal transparent visible={draftMode !== null} onRequestClose={() => setDraftMode(null)}><View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}><Card title={draftMode === 'send' ? 'Enviar para valoración' : draftMode === 'suggest' ? 'Sugerir cambios' : 'Guardar borrador'}><Body>{draftMode === 'send' ? (activeDraft && !activeDraft.submittedAt ? 'Enviarás este borrador a los capitanes para que puedan valorarlo.' : 'Crearás un borrador nuevo para que lo valoren los capitanes. El título debe ser único.') : draftMode === 'suggest' ? 'Actualizarás este borrador y avisarás a los capitanes de los cambios sugeridos.' : 'Pon un nombre para reconocer este once.'}</Body><Field label="Título del borrador" value={draftTitle} onChangeText={setDraftTitle} maxLength={80} editable={!busy} /><Button label={draftMode === 'send' ? 'Enviar' : draftMode === 'suggest' ? 'Sugerir cambios' : 'Guardar'} disabled={busy || !draftTitle.trim()} onPress={() => void saveDraft()} /><Button secondary label="Cerrar" onPress={() => setDraftMode(null)} /></Card></View></Modal>
    <ConfirmDialog visible={confirmPublish} title="Publicar 11" description={activeDraft?.submittedAt ? `Publicarás ${activeDraft.title}. Los jugadores verán este once oficialmente.` : 'Vas a publicar esta alineación sin haberla sometido a valoración con el resto de capitanes. ¿Deseas continuar?'} confirmLabel="Publicar 11" busy={busy} onCancel={() => setConfirmPublish(false)} onConfirm={() => void publishDraft()} />
    <ConfirmDialog visible={confirmDeleteDraft} title="Eliminar borrador" description={`Se eliminarán ${activeDraft?.title ?? 'este borrador'} y sus valoraciones. El once publicado no cambiará.`} confirmLabel="Eliminar borrador" busy={busy} onCancel={() => setConfirmDeleteDraft(false)} onConfirm={() => void removeDraft()} />
    <Modal transparent visible={published} onRequestClose={() => setPublished(false)}><View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}><Card title="🎉 Once publicado"><Body>La alineación ya es oficial para el equipo.</Body><Button label={sharing ? 'Generando imagen…' : 'Generar imagen'} disabled={sharing} onPress={() => void shareImage()} /><Button secondary label="Cerrar" onPress={() => setPublished(false)} /></Card></View></Modal>
  </Screen>;
}

function normalizeHex(value: string) {
  const color = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color.toUpperCase() : null;
}

function countLineupChanges(before: Lineup, after: Lineup) {
  let changes = before.formation === after.formation ? 0 : 1;
  for (const slot of before.slots) { const next = after.slots.find(candidate => candidate.id === slot.id); if (!next || next.playerId !== slot.playerId || next.x !== slot.x || next.y !== slot.y) changes++; }
  const changedBench = new Set([...before.bench, ...after.bench]).size - before.bench.filter(id => after.bench.includes(id)).length;
  return Math.max(1, changes + changedBench);
}

function PresetChip({ label, selected, published = false, disabled, onPress }: { label: string; selected: boolean; published?: boolean; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}${published ? ', once publicado' : ''}`} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={{ position: 'relative', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface, opacity: disabled ? 0.45 : 1 }}><Text style={{ color: selected ? colors.background : colors.text, fontWeight: '700' }}>{label}</Text>{published ? <View pointerEvents="none" style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#48A9FF', borderWidth: 2, borderColor: colors.background }}><Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>✓</Text></View> : null}</Pressable>;
}

function presetFor(document: Lineup | null, preference: LineupLayout | null): SelectedPreset {
  if (!document) return null;
  if (preference && document.formation === preference.formation && document.slots.every(slot => preference.slots.some(saved => saved.id === slot.id && saved.x === slot.x && saved.y === slot.y))) return 'custom';
  return document.formation;
}
