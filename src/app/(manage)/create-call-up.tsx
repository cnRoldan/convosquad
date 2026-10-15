import { useState } from 'react';
import { Switch } from 'react-native';
import { lastNoticeInstant } from '@/features/call-ups/last-notice';
import { router } from 'expo-router';
import { Body, Button, DemoNotice, Field, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { createCallUp } from '@/features/call-ups/service';
import { clubLocalTimeToInstant, clubLocalDateTime } from '@/features/call-ups/local-time';
import { callUpErrorMessage } from '@/features/call-ups/availability';
export default function CreateCallUpScreen() {
  const { isDemo } = useAuth(); const { activeClub, refreshRoster } = useClub();
  const [date, setDate] = useState(() => clubLocalDateTime(activeClub?.timezone ?? 'Europe/Madrid').date); const [time, setTime] = useState('21:50'); const [instant, setInstant] = useState<string | null>(null);
  const [noticeTime, setNoticeTime] = useState('18:45'); const [noticeEnabled, setNoticeEnabled] = useState(true);
  const [noticeInstant, setNoticeInstant] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  function preview() {
    if (!activeClub) return;
    try {
      setMessage('');
      const start = clubLocalTimeToInstant(date.trim(), time.trim(), activeClub.timezone);
      setNoticeInstant(lastNoticeInstant(noticeEnabled, date, noticeTime, activeClub.timezone, start));
      setInstant(start);
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Revisa la fecha y hora.'); }
  }
  async function submit() {
    if (!activeClub || !instant || isDemo || busy) return;
    setBusy(true);
    try { const call = await createCallUp(activeClub.id, instant, 'open', noticeInstant); refreshRoster(); router.replace({ pathname: '/call-up', params: { id: call.id } }); }
    catch (error) { setMessage(callUpErrorMessage(error)); }
    finally { setBusy(false); setInstant(null); }
  }
  return <Screen>
    <Heading title="Crear convocatoria" subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    <Body>Horario del club: {activeClub?.timezone}. Se conservará una fotografía de la plantilla y las pruebas activas. AYUDAS comenzará vacía.</Body>
    <Field label="Fecha (AAAA-MM-DD)" value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" maxLength={10} editable={!busy} />
    <Field label="Hora del club (HH:mm)" value={time} onChangeText={setTime} placeholder="21:50" maxLength={5} editable={!busy} />
    <Body>Enviar un último aviso a quienes sigan sin responder</Body>
    <Switch accessibilityLabel="Enviar último aviso para votar" value={noticeEnabled} onValueChange={setNoticeEnabled} disabled={busy} />
    {noticeEnabled ? <Field label="Último aviso para votar (HH:mm)" value={noticeTime} onChangeText={setNoticeTime} maxLength={5} editable={!busy} /> : null}
    <Body>Hora del club. Si el aviso ya ha pasado, se enviará en la próxima ejecución del servicio, antes de la convocatoria.</Body>
    {message ? <Message error>{message}</Message> : null}
    <Button label="Revisar convocatoria" disabled={busy || isDemo} onPress={preview} />
    <ConfirmDialog visible={Boolean(instant)} title="Crear convocatoria abierta" description={`Partido el ${date} a las ${time}, en ${activeClub?.timezone}. ${noticeEnabled ? `Último aviso para votar a las ${noticeTime}. ` : 'Sin último aviso. '}Todos los jugadores comenzarán sin responder; las pruebas serán informativas.`} busy={busy} confirmLabel="Crear convocatoria" onCancel={() => setInstant(null)} onConfirm={() => { void submit(); }} />
  </Screen>;
}
