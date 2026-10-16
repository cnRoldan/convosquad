import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Linking, View } from 'react-native';
import { Body, Button, Card, Message } from '@/components/ui';
import { IconButton } from '@/components/icon-button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ReorderButtons } from '@/components/reorder-buttons';
import { whatsappUrl } from '@/features/call-ups/phone';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { moveItem } from '@/features/players/categories';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
import { listTrials, listTrialContacts, reorderTrials, withdrawTrial } from './service';
export function TrialSection() {
  const { session, isDemo } = useAuth();
  const { activeClub, currentMembership, rosterVersion } = useClub();
  const clubId = activeClub?.id;
  const admin = currentMembership?.role === 'admin';
  const load = useCallback(() => clubId ? listTrials(clubId) : Promise.resolve([]), [clubId]);
  const trials = useResource(`trials:${session?.user.id}:${clubId}:${admin}:${rosterVersion}`, load, Boolean(session && clubId) && !isDemo);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<{ id: string; name: string; scope: string } | null>(null);
  const scope = `${session?.user.id}:${clubId}`;
  const loadContacts = useCallback(() => listTrialContacts(clubId!), [clubId]);
  const contacts = useResource(`trial-contacts:${scope}:${rosterVersion}`, loadContacts, Boolean(session && clubId && admin && !isDemo));
  const active = trials.data?.filter(trial => trial.status === 'active') ?? [];
  async function move(id: string, direction: -1 | 1) {
    if (!clubId || !admin || isDemo || busy) return;
    const ids = moveItem(active.map(trial => trial.id), id, direction); if (!ids) return;
    setBusy(true); setMessage('');
    try { await reorderTrials(clubId, ids); trials.reload(); }
    catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!pending || pending.scope !== scope || !admin || isDemo || busy) return;
    setBusy(true); setMessage(''); setNotice('');
    try {
      await withdrawTrial(pending.id);
      trials.reload(); contacts.reload(); setPending(null);
      setNotice('Prueba retirada de la plantilla. Las convocatorias anteriores conservan sus datos.');
    } catch (error) { setMessage(backendErrorMessage(error)); }
    finally { setBusy(false); }
  }
  return <Card title="PRUEBAS">
    <Body>Jugadores a prueba del club. No cuentan en los totales de disponibilidad.</Body>
    {admin ? <Button secondary label="Añadir prueba" onPress={() => router.push({ pathname: '/trials/[id]', params: { id: 'new' } })} /> : null}
    {trials.isLoading ? <Body>Cargando pruebas…</Body> : null}
    {trials.error ? <><Message error>{trials.error}</Message><Button secondary label="Reintentar pruebas" onPress={trials.reload} /></> : null}
    {message ? <Message error>{message}</Message> : null}
    {notice ? <Message>{notice}</Message> : null}
    {admin && contacts.error ? <><Message error>No se pudieron cargar los teléfonos privados.</Message><Button secondary label="Reintentar teléfonos" onPress={contacts.reload} /></> : null}
    {trials.data?.map(trial => <Card key={trial.id} title={trial.ea_id}>
      {trial.notes ? <Body>{trial.notes}</Body> : null}
      <Body>Desde {new Date(trial.created_at).toLocaleDateString('es-ES', { timeZone: activeClub?.timezone ?? 'Europe/Madrid' })} · {trial.status === 'active' ? 'En pruebas' : trial.status === 'withdrawn' ? 'Retirado de pruebas' : 'Incorporado a la plantilla'}</Body>
      {admin && trial.player_id ? <Button secondary label="Ver ficha incorporada" onPress={() => router.push({ pathname: '/players/[id]', params: { id: trial.player_id! } })} /> : null}
      {admin && trial.status === 'active' ? <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          <ReorderButtons label={`prueba de ${trial.ea_id}`} first={active[0]?.id === trial.id} last={active.at(-1)?.id === trial.id} disabled={busy || isDemo || trials.isLoading} move={direction => { void move(trial.id, direction); }} />
          <IconButton icon="edit" label={`Editar prueba de ${trial.ea_id}`} disabled={busy || isDemo} onPress={() => router.push({ pathname: '/trials/[id]', params: { id: trial.id } })} />
          <IconButton icon="trash" label={`Quitar prueba de ${trial.ea_id}`} danger disabled={busy || isDemo || trials.isLoading} onPress={() => { setMessage(''); setPending({ id: trial.id, name: trial.ea_id, scope }); }} />
          <IconButton icon="whatsapp" label={`WhatsApp de ${trial.ea_id}`} disabled={busy || isDemo || contacts.isLoading || Boolean(contacts.error) || !contacts.data?.some(contact => contact.trial_id === trial.id)} onPress={() => {
            const phone = contacts.data?.find(contact => contact.trial_id === trial.id)?.phone;
            if (!phone) return;
            setMessage('');
            void Linking.openURL(whatsappUrl(phone)).catch(() => setMessage('No se pudo abrir WhatsApp. Revisa el número e inténtalo de nuevo.'));
          }} />
        </View>
      </> : null}
    </Card>)}
    {!trials.isLoading && !trials.error && !active.length ? <Body>No hay jugadores en pruebas activos.</Body> : null}
    <ConfirmDialog visible={Boolean(admin && pending?.scope === scope)} title="Quitar prueba de la plantilla" description={`¿Quieres quitar a ${pending?.name ?? 'esta prueba'} de la plantilla? No aparecerá en nuevas convocatorias. Las convocatorias anteriores conservarán sus datos.`} confirmLabel="Quitar prueba" busy={busy} onCancel={() => setPending(null)} onConfirm={() => { void remove(); }} />
  </Card>;
}
