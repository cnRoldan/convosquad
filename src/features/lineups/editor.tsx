import { router, useFocusEffect } from 'expo-router';
import { activeIncidents, lineupIncidents } from '@/features/incidents/model';
import { listPlayerIncidents, type PlayerIncident } from '@/features/incidents/service';
import { useIncidentClock } from '@/features/incidents/use-incident-clock';
import { LineupIncidentsModal } from '@/features/incidents/components';
import { t } from '@/features/i18n/runtime';
import { useLeaveGuard } from '@/components/navigation-leave-guard';
import { goalkeeperNumberColor } from './kit-colors';
import { LineupInstructionsButton } from './instructions';
import { useAuth } from '@/features/auth/auth-context';
import { getPerformance } from '@/features/ratings/service';
import { useResource } from '@/hooks/use-resource';
import { suggestPlayers } from './suggestions';
import { lineupPositionExperience } from './service';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { PlayerToken } from './player-token';
import { Body, Button, Card, Field, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { IconButton } from '@/components/icon-button';
import { colors } from '@/theme';
import ColorPicker, { HueSlider, Panel1, Preview } from 'reanimated-color-picker';
import { LineupShareCard } from './share-card';
import { createPosterReadiness, type PosterAsset } from './poster-readiness';
import { getClubCrestUrl } from '@/features/clubs/crest';
import { getClubSettings, listClubMembers } from '@/features/clubs/service';
import { LineupPitch } from './pitch';
import { AddLineupPlayer, type GuestInput } from './add-player';
import { shareLineupImage } from './share-image';
import { requireSupabase } from '@/lib/supabase';
import { unwrap } from '@/lib/backend-result';
import { deleteLineupDraft, deleteLineupPreference, listLineupDrafts, loadLineup, publishLineupDraft, saveLineupDraft, saveLineupPreference, setLineupPlayerColors, setLineupPositionLock, voteLineupDraft, type LineupDraft } from './service';
import { applyLayout, applyPreset, assignPlayer, canPublish, layoutFromLineup, preset, reconcileLineup, removeFromBench, sendToBench, type Candidate, type Preset, type Lineup, type LineupLayout } from './model';

type SelectedPreset = Preset | 'custom' | null;
const formationPresets: { id: Preset; label: string }[] = [
  { id: '4-3-3', label: '4-3-3' }, { id: '4-4-2', label: '4-4-2' },
  { id: '4-4-2-diamond', label: '4-4-2 · Rombo' }, { id: '4-2-3-1', label: '4-2-3-1' },
  { id: '3-5-2', label: '3-5-2' }, { id: '3-5-2-one-pivot', label: '3-5-2 · 1 pivote' },
  { id: '3-5-2-two-pivots', label: '3-5-2 · 2 pivotes' },
];
const historyLimit = 50;

export function LineupEditor({ clubId, clubName, crestPath, callId, captain, initialDraftId }: { clubId: string; clubName: string; crestPath?: string | null | undefined; callId: string; captain: boolean; initialDraftId?: string }) {
  const { session } = useAuth();
  const loadRatings = useCallback(() => getPerformance(clubId, '3m'), [clubId]);
  const ratingHistory = useResource(`lineup-ratings:${session?.user.id}:${clubId}`, loadRatings, captain && Boolean(session));
  const historicalRatings = captain && ratingHistory.data ? new Map(ratingHistory.data.map(row => [row.player_id, row.average_score])) : undefined;
  const historicalScore = (id: string | null | undefined) => historicalRatings && id ? historicalRatings.get(id) ?? null : undefined;
  const { width: windowWidth } = useWindowDimensions();
  const tablet = windowWidth >= 800;
  const leaveGuard = useLeaveGuard();
  const leaving = useSyncExternalStore(leaveGuard.subscribe, leaveGuard.snapshot, leaveGuard.snapshot);
  const baseline = useRef<Lineup | null>(null);
  const [document, setDocument] = useState<Lineup | null>(null);
  const [preference, setPreference] = useState<LineupLayout | null>(null);
  const [playerColor, setPlayerColor] = useState('#B4F16C');
  const [goalkeeperColor, setGoalkeeperColor] = useState('#F4A83A');
  const [customGoalkeeperColor, setCustomGoalkeeperColor] = useState('#F4A83A');
  const [jerseyColor, setJerseyColor] = useState('#0B1210');
  const [selectedPreset, setSelectedPreset] = useState<SelectedPreset>(null);
  const [history, setHistory] = useState<Lineup[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [incidents, setIncidents] = useState<PlayerIncident[]>([]);
  const [showIncidents, setShowIncidents] = useState(false);
  const [publishIncidents, setPublishIncidents] = useState<PlayerIncident[]>([]);
  const [publishError, setPublishError] = useState('');
  const incidentClock = useIncidentClock(incidents);
  const currentIncidents = captain ? activeIncidents(incidents, incidentClock) : [];
  const incidentPlayerIds = new Set(currentIncidents.flatMap(incident => incident.player_id ? [incident.player_id] : []));
  const selectedIncidents = lineupIncidents(document, currentIncidents, incidentClock);
  const currentPublishIncidents = activeIncidents(publishIncidents, incidentClock);
  const [revision, setRevision] = useState(0);
  const [instructions, setInstructions] = useState<Record<string, string>>({});
  const baselineInstructions = useRef<Record<string, string>>({});
  const [instructionTarget, setInstructionTarget] = useState<string | null>(null);
  const [instructionText, setInstructionText] = useState('');
  const [slot, setSlot] = useState<number | null>(null);
  const loadExperience = useCallback(() => lineupPositionExperience(callId), [callId]);
  const experience = useResource(`lineup-experience:${clubId}:${callId}`, loadExperience, captain && slot !== null);
  const suggestions = document && slot !== null ? suggestPlayers(document, slot, candidates, experience.data ?? []) : [];
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
  const [renderingPoster,setRenderingPoster]=useState(false);
  const [posterAssetLoaded,setPosterAssetLoaded]=useState<(asset: PosterAsset) => void>(() => () => undefined);
  const posterReadiness=useRef<ReturnType<typeof createPosterReadiness> | null>(null);
  useEffect(() => () => posterReadiness.current?.cancel(), []);
  const [drafts,setDrafts]=useState<LineupDraft[]>([]);
  const [activeDraftId,setActiveDraftIdState]=useState<string | null>(initialDraftId ?? null);
  const activeDraftIdRef = useRef<string | null>(initialDraftId ?? null);
  const setActiveDraftId = useCallback((id: string | null) => {
    activeDraftIdRef.current = id;
    setActiveDraftIdState(id);
  }, []);
  const [draftMode,setDraftMode]=useState<'save'|'send'|'suggest'|null>(null);
  const [draftTitle,setDraftTitle]=useState('');
  const [confirmPublish,setConfirmPublish]=useState(false);
  const [confirmDeleteDraft,setConfirmDeleteDraft]=useState(false);
  const [published,setPublished]=useState(false);
  const [captainCount,setCaptainCount]=useState(1);
  const [colorPicker,setColorPicker]=useState(false);
  const [editingColor,setEditingColor]=useState<'shirt' | 'jersey' | 'goalkeeper'>('shirt');
  const [customColor,setCustomColor]=useState('#B4F16C');
  const [customJerseyColor,setCustomJerseyColor]=useState('#0B1210');
  const shareImageRef = useRef<View>(null);
  const [shareCrestUrl, setShareCrestUrl] = useState<string | null>(null);
  const editable=captain && active && !busy && !conflict;
  useFocusEffect(useCallback(() => {
    leaveGuard.setHandler(() => captain && dirty);
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    if (Platform.OS === 'web') window.addEventListener('beforeunload', beforeUnload);
    return () => {
      leaveGuard.setHandler(null);
      if (Platform.OS === 'web') window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [leaveGuard, captain, dirty]));
  function discardAndLeave() {
    setDocument(baseline.current);
    setInstructions(baselineInstructions.current);
    setHistory([]); setDirty(false); setLayoutChanged(false);
    setSelectedPreset(presetFor(baseline.current, preference));
    leaveGuard.proceed();
  }
  function cancelDraft() { if (busy) return; setDraftMode(null); leaveGuard.cancel(); }
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
      const requested = rows.find(draft => draft.id === activeDraftIdRef.current);
      const loadedDocument = requested?.document ?? data.document;
      const preset = presetFor(loadedDocument, data.preference);
      baseline.current = loadedDocument;
      const notes = requested?.instructions ?? rows.find(row => row.published)?.instructions ?? {};
      baselineInstructions.current = notes; setInstructions(notes);
      setIncidents(data.incidents);
      setDocument(loadedDocument); setHistory([]); setCandidates(data.candidates); setPreference(data.preference); setPlayerColor(data.playerColor); setJerseyColor(data.jerseyColor);setGoalkeeperColor(data.goalkeeperColor); setSelectedPreset(preset); setRevision(data.revision); setMessage('');
      setActive(data.active);setPositionLocked(data.positionLocked);setDirty(false);setLayoutChanged(false);setConflict(false);
      setDrafts(rows); setActiveDraftId(requested?.id ?? null);
    } catch { setMessage('No se pudo cargar el once.'); }
    finally { setBusy(false); }
  }, [clubId, callId, captain, setActiveDraftId, setDirty, setIncidents]);
  useEffect(() => { const timer=setTimeout(()=>void reload(),0);return ()=>clearTimeout(timer); }, [reload]);
  useEffect(() => { void listClubMembers(clubId).then(rows => setCaptainCount(rows.filter(row => row.role === 'admin' && row.is_active).length)).catch(() => undefined); }, [clubId]);
  useEffect(()=>{
    let live=true;
    const timer=setInterval(()=>{
      if(busy||dragging||adding||slot!==null||benchPlayer!==null) return;
      const selectedId = activeDraftIdRef.current;
      void Promise.all([loadLineup(clubId,callId,captain), captain ? listLineupDrafts(callId) : Promise.resolve([])]).then(([data, rows])=>{
        if(!live || selectedId !== activeDraftIdRef.current) return;
        const selected = rows.find(draft => draft.id === selectedId);
        const refreshedDocument = selected?.document ?? data.document;
        setDrafts(rows); setIncidents(data.incidents);
        setActive(data.active);setCandidates(data.candidates);
        if(dirty){
          if(selectedId ? !selected || selected.revision !== activeDraft?.revision : data.revision!==revision){setConflict(true);setMessage('Otro capitán ha cambiado el once. Recarga antes de continuar.');}
          else setDocument(current=>current?reconcileLineup(current,data.candidates):current);
        }else{const notes=selected?.instructions??rows.find(row=>row.published)?.instructions??{};baselineInstructions.current=notes;setInstructions(notes);baseline.current=refreshedDocument;const preset=presetFor(refreshedDocument,data.preference);setDocument(refreshedDocument);setActiveDraftId(selected?.id ?? null);setHistory([]);setRevision(data.revision);setPreference(data.preference);setPlayerColor(data.playerColor);setJerseyColor(data.jerseyColor);setGoalkeeperColor(data.goalkeeperColor);setPositionLocked(data.positionLocked);setSelectedPreset(preset);setLayoutChanged(false);}
      }).catch(()=>undefined);
    },10000);
    return ()=>{live=false;clearInterval(timer);};
  },[clubId,callId,captain,busy,dragging,adding,slot,benchPlayer,dirty,revision,activeDraftId,activeDraft?.revision,setActiveDraftId]);
  function openDraft(mode: 'save' | 'send' | 'suggest') { setMessage(''); setDraftMode(mode); setDraftTitle(mode === 'send' && (!activeDraft || activeDraft.submittedAt) ? `Borrador #${drafts.length + 1}` : activeDraft?.title ?? `Borrador #${drafts.length + 1}`); }
  async function saveDraft() {
    if (!document || !draftMode || !draftTitle.trim()) return;
    const mode = draftMode;
    const saveAsNew = leaving && Boolean(activeDraft?.submittedAt);
    const sendsExisting = mode === 'send' && Boolean(activeDraft && !activeDraft.submittedAt);
    if (mode === 'send' && !sendsExisting && drafts.some(draft => draft.title.trim().toLocaleLowerCase() === draftTitle.trim().toLocaleLowerCase())) { setMessage('Ya existe un borrador con ese nombre.'); return; }
    setBusy(true);
    try { const saved = await saveLineupDraft(callId, saveAsNew || (mode === 'send' && !sendsExisting) ? null : activeDraft, draftTitle.trim(), document, mode !== 'save', mode === 'suggest' && activeDraft ? countLineupChanges(activeDraft.document, document) : 0, instructions); setActiveDraftId(saved.id); setDraftMode(null); setDirty(false); await reload(); setMessage(mode === 'send' ? (sendsExisting ? 'Borrador enviado para valoración.' : 'Nuevo borrador enviado para valoración.') : mode === 'suggest' ? 'Cambios enviados a valoración.' : 'Borrador guardado.'); if (leaving) leaveGuard.proceed(); }
    catch { setMessage('No se pudo guardar el borrador.'); }
    finally { setBusy(false); }
  }
  async function vote(approved: boolean) { if (!activeDraft) return; setBusy(true); try { await voteLineupDraft(activeDraft.id, approved); await reload(); } catch { setMessage('No se pudo registrar la valoración.'); } finally { setBusy(false); } }
  async function removeDraft() { if (!activeDraft) return; setBusy(true); try { await deleteLineupDraft(activeDraft.id); setActiveDraftId(null); setConfirmDeleteDraft(false); await reload(); setMessage('Borrador eliminado.'); } catch { setMessage('No se pudo eliminar el borrador.'); } finally { setBusy(false); } }
  async function requestPublish() {
    if (busy || !document) return;
    setBusy(true); setPublishError('');
    try {
      const fresh = await listPlayerIncidents(clubId);
      setIncidents(fresh); setPublishIncidents(lineupIncidents(document, fresh, Date.now())); setConfirmPublish(true);
    } catch { setMessage('No se pudieron comprobar las incidencias. Reintenta antes de publicar.'); }
    finally { setBusy(false); }
  }
  async function publishDraft() {
    if (!document || busy) return;
    setBusy(true); setPublishError('');
    try {
      const saved = !activeDraft || dirty ? await saveLineupDraft(callId, activeDraft, activeDraft?.title ?? `Borrador #${drafts.length + 1}`, document, false, 0, instructions) : activeDraft;
      // Preserve the new draft even if publication requires another confirmation.
      setActiveDraftId(saved.id);
      await publishLineupDraft(saved.id, activeIncidents(publishIncidents, Date.now()).map(incident => incident.id));
      setPublished(true); setDirty(false); setConfirmPublish(false); await reload(); setMessage('Once publicado.');
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P0052') {
        await reload();
        try {
          const fresh = await listPlayerIncidents(clubId);
          setIncidents(fresh); setPublishIncidents(lineupIncidents(document, fresh, Date.now()));
          setPublishError('Las incidencias han cambiado. Revísalas y confirma de nuevo la publicación.');
        } catch { setPublishError('No se pudieron comprobar las incidencias. Cierra este aviso y vuelve a intentarlo.'); }
      } else setPublishError('No se pudo publicar el once. Vuelve a intentarlo.');
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
    const player = normalizeHex(customColor), jersey = normalizeHex(customJerseyColor), goalkeeper = normalizeHex(customGoalkeeperColor);
    if (!player || !jersey || !goalkeeper) { setMessage('Introduce colores hexadecimales válidos, por ejemplo #B4F16C.'); return; }
    if (player === playerColor && jersey === jerseyColor && goalkeeper === goalkeeperColor) { setColorPicker(false); return; }
    setBusy(true);
    try { const result = await setLineupPlayerColors(clubId, player, jersey, goalkeeper); setPlayerColor(result.playerColor); setJerseyColor(result.jerseyColor); setCustomColor(result.playerColor); setCustomJerseyColor(result.jerseyColor);setGoalkeeperColor(result.goalkeeperColor);setCustomGoalkeeperColor(result.goalkeeperColor); setColorPicker(false); setMessage('Colores de los jugadores guardados.'); }
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
    setSharing(true); setRenderingPoster(false); setMessage('');
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
      const gate = createPosterReadiness(Boolean(embeddedCrest), 15000, Platform.OS !== 'web');
      posterReadiness.current = gate;
      setPosterAssetLoaded(() => gate.loaded);
      setShareCrestUrl(embeddedCrest); setRenderingPoster(true);
      await gate.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await shareLineupImage(shareImageRef);
    }
    catch { setMessage('No se pudo generar la imagen. Inténtalo de nuevo.'); }
    finally { posterReadiness.current?.cancel(); posterReadiness.current = null; setRenderingPoster(false); setSharing(false); }
  }
  function include(id: string) {
    if (document) change({...document,bench:[...new Set([...document.bench,id])],manualIds:[...new Set([...(document.manualIds??[]),id])],excludedIds:document.excludedIds?.filter(excludedId=>excludedId!==id)});
    setAdding(false);
  }
  async function create(input: GuestInput) {
    const id=unwrap(await requireSupabase().rpc('add_lineup_guest',{p_call_id:callId,p_kind:input.kind,p_name:input.name,p_notes:input.notes,p_phone:input.phone,p_retain:input.retain}));
    setCandidates(current=>[...current,{id,name:input.name,active:true,eligible:false,manual:true}]);include(id);
  }
  return <Screen wide scrollEnabled={!dragging} onRefresh={() => { ratingHistory.reload(); void reload(); }} refreshing={busy}>
    {message ? <Body>{message}</Body> : null}
    {busy ? <Body>Cargando…</Body> : null}
    {document ? <>
      {captain ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {formationPresets.map(({ id, label }) => <PresetChip key={id} label={label} selected={selectedPreset === id} disabled={!editable} onPress={() => { change(applyPreset(document, id)); setSelectedPreset(id); setLayoutChanged(false); }} />)}
        {preference ? <><PresetChip label="Personalizada" selected={selectedPreset === 'custom'} disabled={!editable} onPress={() => { change(applyLayout(document, preference)); setSelectedPreset('custom'); setLayoutChanged(false); }} /><IconButton icon="trash" label="Eliminar posición personalizada" danger disabled={!editable} onPress={() => void deleteCustomLayout()} /></> : null}
        <IconButton icon="save" label="Guardar posición personalizada" disabled={!editable || !layoutChanged} onPress={() => void saveCustomLayout()} />
        <IconButton icon="undo" label="Deshacer último cambio" disabled={!editable || history.length === 0 || dragging} onPress={undo} />
        <Pressable accessibilityRole="button" accessibilityLabel="Configurar colores de jugadores" disabled={!editable} onPress={() => { setCustomColor(playerColor); setCustomJerseyColor(jerseyColor); setCustomGoalkeeperColor(goalkeeperColor); setEditingColor('shirt'); setColorPicker(true); }} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: playerColor, borderWidth: 3, borderColor: jerseyColor, opacity: editable ? 1 : 0.45 }} />
      </View> : null}
      {captain && drafts.length ? <><Text style={{ color: colors.muted, fontSize: 18, fontWeight: '600' }}>Revisa tus borradores</Text><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 6, paddingTop: 9, paddingRight: 9 }}><PresetChip label="Sin borrador" selected={!activeDraftId} disabled={!editable} onPress={() => { setActiveDraftId(null); void reload(); }} />{drafts.map(draft => <PresetChip key={draft.id} label={draft.title} selected={activeDraftId === draft.id} published={draft.published} disabled={!editable} onPress={() => { setActiveDraftId(draft.id); baseline.current = draft.document; baselineInstructions.current = draft.instructions ?? {}; setInstructions(draft.instructions ?? {}); setDocument(draft.document); setSelectedPreset(presetFor(draft.document, preference)); setHistory([]); setDirty(false); setLayoutChanged(false); }} />)}</ScrollView></> : null}
      {captain && activeDraft ? <Card title={`${activeDraft.title} · revisión ${activeDraft.revision}`}>{activeDraft.published ? <><Body>Creado por: {activeDraft.createdBy}</Body><Body>Publicado por: {activeDraft.publishedBy ?? activeDraft.updatedBy}</Body></> : <Body>Modificado por: {activeDraft.updatedBy}</Body>}{activeDraft.suggestedBy && activeDraft.suggestedChanges > 0 ? <Body>{activeDraft.suggestedBy} ha sugerido {activeDraft.suggestedChanges} {activeDraft.suggestedChanges === 1 ? 'cambio' : 'cambios'}.</Body> : null}{!activeDraft.submittedAt ? <Body>Este borrador todavía no se ha enviado a valoración.</Body> : null}<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{activeDraft.submittedAt ? <View style={{ flexDirection: 'row', gap: 8 }}><Button label={`👍 ${activeDraft.upVotes}`} disabled={busy} onPress={() => void vote(true)} /><Button secondary label={`👎 ${activeDraft.downVotes}`} disabled={busy} onPress={() => void vote(false)} /></View> : null}<IconButton icon="trash" label="Eliminar borrador" danger size={52} disabled={busy} onPress={() => setConfirmDeleteDraft(true)} /></View></Card> : null}
      {captain && ratingHistory.error ? <><Body>{t('No se pudieron consultar las medias históricas.')}</Body><Button secondary label={t('Reintentar')} onPress={ratingHistory.reload} /></> : null}
      <View testID="lineup-workspace" style={{ flexDirection: tablet ? 'row' : 'column', alignItems: 'stretch', gap: 20 }}>
      <View ref={shareImageRef} collapsable={false} style={[tablet ? { flex: 1, minWidth: 0 } : undefined, renderingPoster ? { backgroundColor: '#0B1210', alignSelf: 'flex-start', ...(tablet ? {} : { width: '100%' }) } : undefined]}>
        {renderingPoster ? <LineupShareCard onAssetLoad={posterAssetLoaded} clubName={clubName} crestUrl={shareCrestUrl} lineup={document} candidates={candidates} shirtColor={playerColor} numberColor={jerseyColor} goalkeeperColor={goalkeeperColor} /> : <LineupPitch historicalRatings={historicalRatings} incidentPlayerIds={incidentPlayerIds} goalkeeperColor={goalkeeperColor} playerColor={playerColor} jerseyColor={jerseyColor} positionLocked={positionLocked} onTogglePositionLock={editable ? () => void togglePositionLock() : undefined} lineup={document} candidates={candidates} editable={editable} onDragStart={beginDrag} onChange={next => { change(next, false); setSelectedPreset(null); setLayoutChanged(true); }} onDragging={setDragging} onSelect={s => setSlot(s.id)} />}
      </View>
      <View testID="lineup-controls" style={{ gap: 20, ...(tablet ? { width: 280 } : {}) }}>
      <LineupInstructionsButton callId={callId} captain={captain} />
      {captain && selectedIncidents.length ? <Button secondary label="Consultar incidencias de jugadores" onPress={() => setShowIncidents(true)} /> : null}
      {captain ? <Button secondary label="Histórico de incidencias" onPress={() => router.push('/incident-history')} /> : null}
      <Card title="Banquillo">
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{gap:4,paddingVertical:8}} accessibilityLabel="Jugadores del banquillo">
          {document.bench.map(id => <Pressable accessibilityRole="button" accessibilityLabel={`Gestionar ${candidates.find(p => p.id === id)?.name ?? 'jugador'} en el banquillo`} disabled={!editable} key={id} onPress={() => setBenchPlayer(id)}><PlayerToken averageScore={historicalScore(id)} compact warning={incidentPlayerIds.has(id)} color={playerColor} jerseyColor={jerseyColor} player={candidates.find(p => p.id === id)} /></Pressable>)}
          {captain ? <Pressable accessibilityRole="button" accessibilityLabel="Añadir al banquillo" disabled={!editable} onPress={()=>setAdding(true)} style={{opacity:editable?1:0.45}}><PlayerToken compact /></Pressable> : null}
        </ScrollView>
      </Card>
      {captain ? <><Button label={activeDraft?.submittedAt ? "Sugerir cambios" : "Guardar borrador"} disabled={!editable || Boolean(activeDraft?.submittedAt && !dirty)} onPress={() => openDraft(activeDraft?.submittedAt ? 'suggest' : 'save')} />{captainCount > 1 ? <Button label="Enviar para valoración" disabled={!editable || (!dirty && (!activeDraft || Boolean(activeDraft.submittedAt)))} onPress={() => openDraft('send')} /> : null}<Button label={activeDraft?.published ? "Republicar 11" : "Publicar 11"} disabled={!editable || !canPublish(document) || Boolean(activeDraft?.published && !dirty)} onPress={() => void requestPublish()} />{!canPublish(document)?<Body>Completa las once posiciones para publicar.</Body>:null}{dirty?<Body>Tienes cambios sin guardar.</Body>:null}</> : null}
      </View>
      </View>
    </> : !busy ? <Body>El capitán todavía está preparando el 11.</Body> : null}
    {adding && document ? <AddLineupPlayer incidentPlayerIds={incidentPlayerIds} playerColor={playerColor} jerseyColor={jerseyColor} candidates={candidates.filter(p=>!document.bench.includes(p.id)&&!document.slots.some(s=>s.playerId===p.id))} select={include} create={create} close={()=>setAdding(false)} /> : null}
    <Modal transparent visible={slot !== null && instructionTarget === null} onRequestClose={() => setSlot(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}><ScrollView style={{ maxHeight: '80%' }}><Card title="Cambiar jugador">
        {document && slot !== null ? <>
          {document.slots.find(s=>s.id===slot)?.playerId ? <Button label="Mandar al banquillo" disabled={!editable} onPress={() => { change(sendToBench(document, slot)); setSlot(null); }} />:null}
          {(() => { const id = document.slots.find(item => item.id === slot)?.playerId; const player = candidates.find(item => item.id === id); return id && player?.category ? <Button secondary label={t(instructions[id] ? 'Editar indicaciones' : 'Añadir indicaciones')} disabled={!editable} onPress={() => { setInstructionTarget(id); setInstructionText(instructions[id] ?? ''); }} /> : null; })()}
          <Body>Banquillo</Body>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 4, paddingVertical: 8 }} accessibilityLabel="Elegir jugador del banquillo">
            {document.bench.map(id => <Pressable accessibilityRole="button" accessibilityLabel={`Elegir ${candidates.find(p => p.id === id)?.name ?? 'jugador'}`} disabled={!editable} key={id} onPress={() => { change(assignPlayer(document, slot, id)); setSlot(null); }}><PlayerToken averageScore={historicalScore(id)} compact warning={incidentPlayerIds.has(id)} color={playerColor} jerseyColor={jerseyColor} player={candidates.find(p => p.id === id)} /></Pressable>)}
          </ScrollView>
          {document.slots.some(s => s.id !== slot && s.playerId) ? <><Body>Campo</Body><ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 4, paddingVertical: 8 }} accessibilityLabel="Intercambiar con jugador del campo">
            {document.slots.filter(s => s.id !== slot && s.playerId).map(s => { const player = candidates.find(p => p.id === s.playerId); return <Pressable accessibilityRole="button" accessibilityLabel={`Intercambiar con ${player?.name ?? 'jugador'}`} disabled={!editable} key={s.id} onPress={() => { if (s.playerId) { change(assignPlayer(document, slot, s.playerId)); setSlot(null); } }}><PlayerToken averageScore={historicalScore(player?.id)} compact warning={Boolean(player && incidentPlayerIds.has(player.id))} color={playerColor} jerseyColor={jerseyColor} player={player} /></Pressable>; })}
          </ScrollView></> : null}
          <Body>{t('Sugerencias')}</Body>
          {experience.isLoading ? <Body>{t('Consultando posiciones anteriores…')}</Body> : null}
          {experience.error ? <><Body>{t('No se pudo consultar el histórico. Se muestran las coincidencias de plantilla.')}</Body><Button secondary label={t('Reintentar')} onPress={experience.reload} /></> : null}
          {!experience.isLoading && !suggestions.length ? <Body>{t('No hay sugerencias para esta posición entre los jugadores del campo y el banquillo.')}</Body> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 12, paddingVertical: 8 }} accessibilityLabel={t('Jugadores sugeridos')}>
            {suggestions.map(({ player, rosterMatch, appearances }) => <Pressable key={player.id} accessibilityRole="button" accessibilityLabel={t('Elegir {{v0}}', { v0: player.name })} disabled={!editable} onPress={() => { change(assignPlayer(document, slot, player.id)); setSlot(null); }} style={{ width: 120, alignItems: 'center', gap: 4 }}>
              <PlayerToken averageScore={historicalScore(player.id)} compact warning={incidentPlayerIds.has(player.id)} color={playerColor} jerseyColor={jerseyColor} player={player} />
              {rosterMatch ? <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 12 }}>{t('Posición de plantilla')}</Text> : null}
              {appearances > 0 ? <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 12 }}>{t(appearances === 1 ? 'Ya jugó aquí · 1 convocatoria' : 'Ya jugó aquí · {{v0}} convocatorias', { v0: appearances })}</Text> : null}
            </Pressable>)}
          </ScrollView>
        </> : null}
        <Button label="Cerrar" onPress={() => setSlot(null)} />
      </Card></ScrollView></View>
    </Modal>
    <Modal transparent visible={instructionTarget !== null} onRequestClose={() => setInstructionTarget(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}><ScrollView style={{ maxHeight: '80%' }}><Card title={t('Indicaciones para {{v0}}', { v0: candidates.find(player => player.id === instructionTarget)?.name ?? '' })}>
        <Body>{t('El jugador recibirá estas indicaciones al publicar el once. Solo él y los capitanes podrán consultarlas.')}</Body>
        <Body>{t('El aviso solo se enviará si el jugador tiene una cuenta vinculada al club y las notificaciones activadas.')}</Body>
        <Field label={t('Indicaciones')} multiline maxLength={1000} style={{ minHeight: 140 }} value={instructionText} onChangeText={setInstructionText} />
        <Body>{t('Deja el texto vacío para quitar la indicación del borrador.')}</Body>
        <Button label={t('Guardar indicaciones')} disabled={!editable} onPress={() => {
          if (!instructionTarget) return;
          const text = instructionText.trim();
          if ((instructions[instructionTarget] ?? '') !== text) {
            setInstructions(current => { const next = { ...current }; if (text) next[instructionTarget] = text; else delete next[instructionTarget]; return next; });
            setDirty(true);
          }
          setInstructionTarget(null); setSlot(null);
        }} />
        <Button secondary label={t('Cancelar')} onPress={() => setInstructionTarget(null)} />
      </Card></ScrollView></View>
    </Modal>
    <Modal transparent visible={benchPlayer !== null} onRequestClose={() => setBenchPlayer(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}><Card title="Jugador en el banquillo">
        {benchPlayer ? <View style={{ alignItems: 'center', paddingVertical: 8 }}><PlayerToken averageScore={historicalScore(benchPlayer)} warning={incidentPlayerIds.has(benchPlayer)} color={playerColor} jerseyColor={jerseyColor} player={candidates.find(p => p.id === benchPlayer)} /></View> : null}
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
          <Pressable accessibilityRole="button" accessibilityState={{ selected: editingColor === 'goalkeeper' }} onPress={() => setEditingColor('goalkeeper')} style={{ flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 12, borderWidth: 2, borderColor: editingColor === 'goalkeeper' ? colors.primary : colors.border, backgroundColor: customGoalkeeperColor }}><Text style={{ color: goalkeeperNumberColor(customGoalkeeperColor), fontWeight: '800', textAlign: 'center' }}>Portero</Text></Pressable>
        </View>
        <ColorPicker key={editingColor} value={editingColor === 'shirt' ? customColor : editingColor === 'goalkeeper' ? customGoalkeeperColor : customJerseyColor} onChangeJS={result => { if (editingColor === 'shirt') setCustomColor(result.hex); else if (editingColor === 'goalkeeper') setCustomGoalkeeperColor(result.hex); else setCustomJerseyColor(result.hex); }} style={{ gap: 12 }} sliderThickness={22} thumbSize={24} thumbColor={colors.text}>
          <Panel1 style={{ height: 190, borderRadius: 14 }} />
          <HueSlider style={{ borderRadius: 12 }} />
          <Preview hideInitialColor style={{ borderRadius: 12 }} />
        </ColorPicker>
        <Field label="Color de la camiseta" value={customColor} onChangeText={setCustomColor} autoCapitalize="characters" maxLength={7} editable={!busy} />
        <Field label="Color de dorsales" value={customJerseyColor} onChangeText={setCustomJerseyColor} autoCapitalize="characters" maxLength={7} editable={!busy} />
        <Field label="Color del portero" value={customGoalkeeperColor} onChangeText={setCustomGoalkeeperColor} autoCapitalize="characters" maxLength={7} editable={!busy} />
        <Button label="Aplicar colores" disabled={busy || !normalizeHex(customColor) || !normalizeHex(customJerseyColor) || !normalizeHex(customGoalkeeperColor)} onPress={() => void saveColors()} />
        <Button secondary label="Cerrar" onPress={() => setColorPicker(false)} />
      </Card></View>
    </Modal>
    <Modal transparent visible={draftMode !== null} onRequestClose={() => { if (!busy) cancelDraft(); }}><View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}><Card title={draftMode === 'send' ? 'Enviar para valoración' : draftMode === 'suggest' ? 'Sugerir cambios' : 'Guardar borrador'}><Body>{draftMode === 'send' ? (activeDraft && !activeDraft.submittedAt ? 'Enviarás este borrador a los capitanes para que puedan valorarlo.' : 'Crearás un borrador nuevo para que lo valoren los capitanes. El título debe ser único.') : draftMode === 'suggest' ? 'Actualizarás este borrador y avisarás a los capitanes de los cambios sugeridos.' : 'Pon un nombre para reconocer este once.'}</Body>{message ? <Body>{message}</Body> : null}<Field label="Título del borrador" value={draftTitle} onChangeText={setDraftTitle} maxLength={80} editable={!busy} /><Button label={draftMode === 'send' ? 'Enviar' : draftMode === 'suggest' ? 'Sugerir cambios' : 'Guardar'} disabled={busy || !draftTitle.trim()} onPress={() => void saveDraft()} /><Button secondary label="Cerrar" onPress={cancelDraft} /></Card></View></Modal>
    <ConfirmDialog visible={leaving && draftMode === null} title="Tienes cambios sin guardar" description="Guarda los cambios como borrador antes de salir o descártalos." confirmLabel="Guardar borrador y salir" busy={busy} onCancel={() => leaveGuard.cancel()} onConfirm={() => {
      openDraft('save');
      if (activeDraft?.submittedAt) setDraftTitle(`Borrador #${drafts.length + 1}`);
    }}>
      <Button secondary label="Salir sin guardar" disabled={busy} onPress={discardAndLeave} />
    </ConfirmDialog>
    {captain && showIncidents ? <LineupIncidentsModal incidents={selectedIncidents} onDeleted={id => { setIncidents(current => current.filter(incident => incident.id !== id)); setPublishIncidents(current => current.filter(incident => incident.id !== id)); }} close={() => setShowIncidents(false)} /> : null}
    <ConfirmDialog visible={confirmPublish && !showIncidents} title="Publicar 11" description={currentPublishIncidents.length ? t('Vas a publicar una alineación con jugadores que tienen incidencias.') : activeDraft?.submittedAt ? `Publicarás ${activeDraft.title}. Los jugadores verán este once oficialmente.` : 'Vas a publicar esta alineación sin haberla sometido a valoración con el resto de capitanes. ¿Deseas continuar?'} confirmLabel="Publicar 11" busy={busy} onCancel={() => setConfirmPublish(false)} onConfirm={() => void publishDraft()}>
      {currentPublishIncidents.length ? <Button secondary label="Consultar incidencias de jugadores" disabled={busy} onPress={() => setShowIncidents(true)} /> : null}
      {publishError ? <Body>{t(publishError)}</Body> : null}
    </ConfirmDialog>
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
  return formationPresets.find(({ id }) => preset(id).every(point => document.slots.some(slot => slot.id === point.id && Math.abs(slot.x - point.x) < 0.001 && Math.abs(slot.y - point.y) < 0.001)))?.id ?? null;
}
