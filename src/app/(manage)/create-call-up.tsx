import { DateTimeField } from '@/components/date-time-field';
import { t, useLanguage, intlLocale } from '@/features/i18n/runtime';
import { endInstant } from '@/features/call-ups/end-time';
import { closingInstant } from '@/features/call-ups/closing-time';
import { useState } from 'react';
import { Switch } from 'react-native';
import { lastNoticeInstant } from '@/features/call-ups/last-notice';
import { router } from 'expo-router';
import { Body, Button, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { createCallUp } from '@/features/call-ups/service';
import { clubLocalTimeToInstant, clubLocalDateTime } from '@/features/call-ups/local-time';
import { callUpErrorMessage } from '@/features/call-ups/availability';
import { MyPlayerNotice } from '@/features/players/my-player-notice';
export default function CreateCallUpScreen() {
  useLanguage();
  const { isDemo } = useAuth(); const { activeClub, refreshRoster } = useClub();
  const [date, setDate] = useState(() => clubLocalDateTime(activeClub?.timezone ?? 'Europe/Madrid').date); const [time, setTime] = useState('21:50'); const [instant, setInstant] = useState<string | null>(null);
  const [noticeTime, setNoticeTime] = useState('18:45'); const [noticeEnabled, setNoticeEnabled] = useState(true);
  const [noticeInstant, setNoticeInstant] = useState<string | null>(null);
  const [closingEnabled, setClosingEnabled] = useState(true);
  const [closingTime, setClosingTime] = useState('19:00');
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [evaluationEnabled, setEvaluationEnabled] = useState(true);
  const [endTime, setEndTime] = useState('00:00');
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  function preview() {
    if (!activeClub) return;
    try {
      setMessage('');
      const start = clubLocalTimeToInstant(date.trim(), time.trim(), activeClub.timezone);
      const notice = lastNoticeInstant(noticeEnabled, date, noticeTime, activeClub.timezone, start);
      const closing = closingInstant(closingEnabled, date, closingTime, activeClub.timezone, start, notice);
      if (closing && Date.parse(closing) <= Date.now()) throw new Error(t("Elige una hora de cierre que todavía no haya pasado."));
      setEndsAt(endInstant(date, endTime, activeClub.timezone, start));
      setNoticeInstant(notice); setClosesAt(closing);
      setInstant(start);
    }
    catch (error) { setMessage(error instanceof Error ? error.message : t("Revisa la fecha y hora.")); }
  }
  async function submit() {
    if (!activeClub || !instant || isDemo || busy) return;
    setBusy(true);
    try { const call = await createCallUp(activeClub.id, instant, 'open', noticeInstant, closesAt, endsAt, evaluationEnabled); refreshRoster(); router.replace({ pathname: '/call-up', params: { id: call.id } }); }
    catch (error) { setMessage(callUpErrorMessage(error)); }
    finally { setBusy(false); setInstant(null); }
  }
  return <Screen>
    <Heading title={t("Crear convocatoria")} subtitle={activeClub?.name ?? ''} />
    <MyPlayerNotice />
    {isDemo ? <DemoNotice /> : null}
    <Body>{t("Horario del club: {{v0}}. Se conservará una fotografía de la plantilla y las pruebas activas. AYUDAS comenzará vacía.", { v0: activeClub?.timezone })}</Body>
    <DateTimeField mode="date" label={t("Fecha (AAAA-MM-DD)")} value={date} onChange={setDate} disabled={busy} />
    <DateTimeField mode="time" label={t("Hora de convocatoria (HH:mm)")} value={time} onChange={setTime} disabled={busy} />
    <Body>{t("Cerrar la votación automáticamente")}</Body>
    <Switch accessibilityLabel={t("Cierre automático de votación")} value={closingEnabled} onValueChange={setClosingEnabled} disabled={busy} />
    {closingEnabled ? <DateTimeField mode="time" label={t("Hora de cierre de votación (HH:mm)")} value={closingTime} onChange={setClosingTime} disabled={busy} /> : null}
    <Body>{t("Se usa la zona horaria de la convocatoria. Al cerrar ya no se podrán enviar ni cambiar votos.")}</Body>
    <Body>{t("Enviar un último aviso a quienes sigan sin responder")}</Body>
    <Switch accessibilityLabel={t("Enviar último aviso para votar")} value={noticeEnabled} onValueChange={setNoticeEnabled} disabled={busy} />
    {noticeEnabled ? <DateTimeField mode="time" label={t("Último aviso para votar (HH:mm)")} value={noticeTime} onChange={setNoticeTime} disabled={busy} /> : null}
    <Body>{t("Hora del club. Si el aviso ya ha pasado, se enviará en la próxima ejecución del servicio, antes de la convocatoria.")}</Body>
    <DateTimeField mode="time" label={t("Hora de finalización (HH:mm)")} value={endTime} onChange={setEndTime} disabled={busy} />
    <Body>{t("Hora del club. Si es anterior o igual al inicio, se usará el día siguiente. A esa hora la convocatoria pasará al historial.")}</Body>
    <Body>{t("Habilitar valoración de jugadores")}</Body>
    <Switch accessibilityLabel={t("Habilitar valoración de jugadores")} value={evaluationEnabled} onValueChange={setEvaluationEnabled} disabled={busy} />
    {evaluationEnabled ? <Body>{t("Las valoraciones se abrirán al finalizar la convocatoria. En ese momento avisaremos a los capitanes.")}</Body> : null}
    {message ? <Message error>{message}</Message> : null}
    <Button label={t("Revisar convocatoria")} disabled={busy || isDemo} onPress={preview} />
    <Button secondary label={t("Volver a convocatoria")} disabled={busy} onPress={() => router.dismissTo('/call-up')} />
    <ConfirmDialog visible={Boolean(instant)} title={t("Crear convocatoria abierta")} description={t("Partido el {{v0}} a las {{v1}}, en {{v2}}. {{v3}}{{v4}}{{v5}}", { v0: date, v1: time, v2: activeClub?.timezone, v5: (endsAt ? t("Finalización: {{v0}}. ", { v0: new Date(endsAt).toLocaleString(intlLocale(), { timeZone: activeClub?.timezone ?? 'Europe/Madrid' }) }) : '') + (evaluationEnabled ? t("Las valoraciones se abrirán al finalizar la convocatoria. ") : '') + t("Se respetarán las decisiones mantenidas; el resto comenzará sin responder. Las pruebas serán informativas."), v3: closingEnabled ? t("Cierre de votación a las {{v0}}. ", { v0: closingTime }) : t("Sin cierre automático. "), v4: noticeEnabled ? t("Último aviso para votar a las {{v0}}. ", { v0: noticeTime }) : t("Sin último aviso. ") })} busy={busy} confirmLabel={t("Crear convocatoria")} onCancel={() => setInstant(null)} onConfirm={() => { void submit(); }} />
  </Screen>;
}
