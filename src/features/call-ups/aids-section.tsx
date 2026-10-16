import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Body, Button, Field, Message } from '@/components/ui';
import { IconButton } from '@/components/icon-button';
import { Text, View } from 'react-native';
import { ReorderButtons } from '@/components/reorder-buttons';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { moveItem } from '@/features/players/categories';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
import { listAids, saveAid, deleteAid, reorderAids } from './service';
import { CompactPanel } from './compact-panel';
import { colors } from '@/theme';
import type { Tables } from '@/types/database';
export function AidsSection({ callUpId, editable, revision = 0 }: { callUpId: string; editable: boolean; revision?: number }) {
  const { session, isDemo } = useAuth(); const { activeClub } = useClub(); const clubId = activeClub?.id;
  const load = useCallback(() => listAids(callUpId), [callUpId]);
  const result = useResource(`aids:${session?.user.id}:${clubId}:${callUpId}`, load, Boolean(session && clubId) && !isDemo);
  const { reload } = result;
  useEffect(() => { if (revision) reload(); }, [revision, reload]);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(false);
  useFocusEffect(useCallback(() => { setExpanded(false); }, []));
  const [deleting, setDeleting] = useState<string | null>(null);
  async function mutate(action: () => Promise<unknown>) {
    if (!editable || !clubId || isDemo || busy) return false;
    setBusy(true); setMessage('');
    try { await action(); result.reload(); setDeleting(null); return true; }
    catch (error) { setMessage(backendErrorMessage(error)); return false; }
    finally { setBusy(false); }
  }
  function save(body: string, id?: string) {
    if (!clubId) return;
    if (!body.trim() || body.trim().length > 500) return setMessage('Introduce una anotación de hasta 500 caracteres.');
    void mutate(() => saveAid(clubId, callUpId, body.trim(), id)).then(saved => { if (saved && !id) setText(''); });
  }
  function move(id: string, direction: -1 | 1) {
    const ids = moveItem(result.data?.map(row => row.id) ?? [], id, direction);
    if (ids) void mutate(() => reorderAids(callUpId, ids));
  }
  return <CompactPanel title={`AYUDAS (${result.data?.length ?? 0})`} expanded={expanded} onToggle={() => setExpanded(value => !value)} subtle>
    {result.isLoading ? <Body>Cargando ayudas…</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button label="Reintentar ayudas" onPress={result.reload} /></> : null}
    {message ? <Message error>{message}</Message> : null}
    {result.data?.map((aid, index) => <AidRow key={`${aid.id}:${aid.body}`} aid={aid} ordinal={index + 1} editable={editable} disabled={busy || isDemo || result.isLoading} first={index === 0} last={index === (result.data?.length ?? 0) - 1} save={body => save(body, aid.id)} remove={() => setDeleting(aid.id)} move={direction => move(aid.id, direction)} />)}
    {!result.isLoading && !result.error && !result.data?.length ? <Body>Esta convocatoria no tiene ayudas.</Body> : null}
    {editable ? <View style={{ gap: 12 }}><Field label="Nueva ayuda" value={text} onChangeText={setText} maxLength={500} multiline editable={!busy} /><Button label="Añadir ayuda" disabled={busy || isDemo || result.isLoading || Boolean(result.error)} onPress={() => save(text)} /></View> : null}
    <ConfirmDialog visible={Boolean(deleting)} title="Eliminar anotación" description="Se eliminará únicamente esta ayuda de la convocatoria seleccionada." busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) void mutate(() => deleteAid(deleting, callUpId)); }} />
  </CompactPanel>;
}
function AidRow({ aid, ordinal, editable, disabled, first, last, save, remove, move }: { aid: Tables<'call_up_aids'>; ordinal: number; editable: boolean; disabled: boolean; first: boolean; last: boolean; save: (body: string) => void; remove: () => void; move: (direction: -1 | 1) => void }) {
  const [body, setBody] = useState(aid.body);
  return <View style={{ paddingVertical: 8, gap: 6, borderTopWidth: 1, borderColor: colors.border }}>
    {editable ? <><Field label={`Texto de ayuda ${ordinal}`} value={body} onChangeText={setBody} maxLength={500} multiline editable={!disabled} /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}><ReorderButtons label={`ayuda ${ordinal}`} first={first} last={last} disabled={disabled} move={move} /><IconButton icon="save" label={`Guardar ayuda ${ordinal}`} disabled={disabled} onPress={() => save(body)} /><IconButton icon="trash" label={`Eliminar ayuda ${ordinal}`} danger disabled={disabled} onPress={remove} /></View></> : <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>{ordinal}. {aid.body}</Text>}
  </View>;
}
