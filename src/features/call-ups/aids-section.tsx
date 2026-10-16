import { t, useLanguage } from '@/features/i18n/runtime';
import { PrivatePhoneField } from '@/features/call-ups/private-phone-field';
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
import { listAids, saveAidWithContact, deleteAid, reorderAids } from './service';
import { listCallUpContacts } from './contacts';
import { PhoneContact } from './phone-contact';
import { normalizePhone } from './phone';
import { CompactPanel } from './compact-panel';
import { colors } from '@/theme';
import type { Tables } from '@/types/database';
export function AidsSection({ callUpId, editable, revision = 0 }: { callUpId: string; editable: boolean; revision?: number }) {
  useLanguage();
  const { session, isDemo } = useAuth(); const { activeClub, currentMembership } = useClub(); const clubId = activeClub?.id;
  const load = useCallback(() => listAids(callUpId), [callUpId]);
  const result = useResource(`aids:${session?.user.id}:${clubId}:${callUpId}`, load, Boolean(session && clubId) && !isDemo);
  const admin = currentMembership?.role === 'admin';
  const loadContacts = useCallback(() => listCallUpContacts(callUpId), [callUpId]);
  const contacts = useResource(`aid-contacts:${session?.user.id}:${callUpId}:${revision}`, loadContacts, Boolean(session && clubId && admin && !isDemo));
  const { reload } = result;
  useEffect(() => { if (revision) reload(); }, [revision, reload]);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [expanded, setExpanded] = useState(false);
  useFocusEffect(useCallback(() => { setExpanded(false); }, []));
  const [deleting, setDeleting] = useState<string | null>(null);
  async function mutate(action: () => Promise<unknown>) {
    if (!editable || !clubId || isDemo || busy) return false;
    setBusy(true); setMessage('');
    try { await action(); result.reload(); contacts.reload(); setDeleting(null); return true; }
    catch (error) { setMessage(backendErrorMessage(error)); return false; }
    finally { setBusy(false); }
  }
  function save(body: string, phoneValue: string, id?: string) {
    if (!clubId) return;
    if (!body.trim() || body.trim().length > 500) return setMessage("Introduce una anotación de hasta 500 caracteres.");
    let normalized: string | null;
    try { normalized = normalizePhone(phoneValue); } catch (error) { setMessage((error as Error).message); return; }
    void mutate(() => saveAidWithContact(callUpId, body.trim(), normalized, id)).then(saved => { if (saved && !id) { setText(''); setPhone(''); } });
  }
  function move(id: string, direction: -1 | 1) {
    const ids = moveItem(result.data?.map(row => row.id) ?? [], id, direction);
    if (ids) void mutate(() => reorderAids(callUpId, ids));
  }
  return <CompactPanel title={t("AYUDAS ({{v0}})", { v0: result.data?.length ?? 0 })} expanded={expanded} onToggle={() => setExpanded(value => !value)} subtle>
    {result.isLoading ? <Body>{t("Cargando ayudas…")}</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button label={t("Reintentar ayudas")} onPress={result.reload} /></> : null}
    {admin && contacts.error ? <Message error>{t("No se pudieron cargar los teléfonos privados. Reintenta antes de editar las ayudas.")}</Message> : null}
    {message ? <Message error>{message}</Message> : null}
    {result.data?.map((aid, index) => <AidRow key={`${aid.id}:${aid.body}:${contacts.data?.find(contact => contact.aid_id === aid.id)?.phone ?? ''}`} aid={aid} phone={contacts.data?.find(contact => contact.aid_id === aid.id)?.phone ?? ''} captain={admin} ordinal={index + 1} editable={editable} disabled={busy || isDemo || result.isLoading || (admin && (contacts.isLoading || Boolean(contacts.error)))} first={index === 0} last={index === (result.data?.length ?? 0) - 1} save={(body, phoneValue) => save(body, phoneValue, aid.id)} remove={() => setDeleting(aid.id)} move={direction => move(aid.id, direction)} />)}
    {!result.isLoading && !result.error && !result.data?.length ? <Body>{t("Esta convocatoria no tiene ayudas.")}</Body> : null}
    {editable ? <View style={{ gap: 12 }}><Field label={t("Nueva ayuda")} value={text} onChangeText={setText} maxLength={500} multiline editable={!busy} /><PrivatePhoneField label={t("Teléfono de la ayuda (solo capitanes, opcional)")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} editable={!busy} /><Button label={t("Añadir ayuda")} disabled={busy || isDemo || result.isLoading || Boolean(result.error)} onPress={() => save(text, phone)} /></View> : null}
    <ConfirmDialog visible={Boolean(deleting)} title={t("Eliminar anotación")} description={t("Se eliminará únicamente esta ayuda de la convocatoria seleccionada.")} busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => { if (deleting) void mutate(() => deleteAid(deleting, callUpId)); }} />
  </CompactPanel>;
}
function AidRow({ aid, phone, captain, ordinal, editable, disabled, first, last, save, remove, move }: { aid: Tables<'call_up_aids'>; phone: string; captain: boolean; ordinal: number; editable: boolean; disabled: boolean; first: boolean; last: boolean; save: (body: string, phone: string) => void; remove: () => void; move: (direction: -1 | 1) => void }) {
  useLanguage();
  const [body, setBody] = useState(aid.body);
  const [phoneValue, setPhoneValue] = useState(phone);
  return <View style={{ paddingVertical: 8, gap: 6, borderTopWidth: 1, borderColor: colors.border }}>
    {editable ? <><Field label={t("Texto de ayuda {{v0}}", { v0: ordinal })} value={body} onChangeText={setBody} maxLength={500} multiline editable={!disabled} /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}><ReorderButtons label={t("ayuda {{v0}}", { v0: ordinal })} first={first} last={last} disabled={disabled} move={move} /><IconButton icon="save" label={t("Guardar ayuda {{v0}}", { v0: ordinal })} disabled={disabled} onPress={() => save(body, phoneValue)} /><IconButton icon="trash" label={t("Eliminar ayuda {{v0}}", { v0: ordinal })} danger disabled={disabled} onPress={remove} /></View></> : <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>{ordinal}. {aid.body}</Text>}
    {captain ? <PhoneContact phone={phoneValue} label={t("ayuda {{v0}}", { v0: ordinal })} editable={editable && !disabled} onChange={setPhoneValue} /> : null}
  </View>;
}
