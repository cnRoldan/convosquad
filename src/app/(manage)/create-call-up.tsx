import { t, useLanguage, intlLocale } from '@/features/i18n/runtime';
import { evaluationInstant } from '@/features/ratings/schedule';
import { closingInstant } from '@/features/call-ups/closing-time';
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
  useLanguage();
  const { isDemo } = useAuth(); const { activeClub, refreshRoster } = useClub();
  const [date, setDate] = useState(() => clubLocalDateTime(activeClub?.timezone ?? 'Europe/Madrid').date); const [time, setTime] = useState('21:50'); const [instant, setInstant] = useState<string | null>(null);
  const [noticeTime, setNoticeTime] = useState('18:45'); const [noticeEnabled, setNoticeEnabled] = useState(true);
  const [noticeInstant, setNoticeInstant] = useState<string | null>(null);
  const [closingEnabled, setClosingEnabled] = useState(true);
  const [closingTime, setClosingTime] = useState('21:50');
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [evaluationEnabled, setEvaluationEnabled] = useState(false);
  const [evaluationTime, setEvaluationTime] = useState('23:45');
  const [evaluationAt, setEvaluationAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  function preview() {
    if (!activeClub) return;
    try {
      setMessage('');
      const start = clubLocalTimeToInstant(date.trim(), time.trim(), activeClub.timezone);
      const notice = lastNoticeInstant(noticeEnabled, date, noticeTime, activeClub.timezone, start);
      const closing = closingInstant(closingEnabled, date, closingTime, activeClub.timezone, start, notice);
      if (closing && Date.parse(closing) <= Date.now()) throw new Error(t("Elige una hora de cierre que todavía no haya pasado."));
      setEvaluationAt(evaluationInstant(evaluationEnabled, date, evaluationTime, activeClub.timezone, start));
      setNoticeInstant(notice); setClosesAt(closing);
      setInstant(start);
    }
    catch (error) { setMessage(error instanceof Error ? error.message : t("Revisa la fecha y hora.")); }
  }
  async function submit() {
    if (!activeClub || !instant || isDemo || busy) return;
    setBusy(true);
    try { const call = await createCallUp(activeClub.id, instant, 'open', noticeInstant, closesAt, evaluationAt); refreshRoster(); router.replace({ pathname: '/call-up', params: { id: call.id } }); }
    catch (error) { setMessage(callUpErrorMessage(error)); }
    finally { setBusy(false); setInstant(null); }
  }
  return <Screen>
    <Heading title={t("Crear convocatoria")} subtitle={activeClub?.name ?? ''} />
    {isDemo ? <DemoNotice /> : null}
    <Body>{t("Horario del club: {{v0}}. Se conservará una fotografía de la plantilla y las pruebas activas. AYUDAS comenzará vacía.", { v0: activeClub?.timezone })}</Body>
    <Field label={t("Fecha (AAAA-MM-DD)")} value={date} onChangeText={setDate} placeholder={t("AAAA-MM-DD")} maxLength={10} editable={!busy} />
    <Field label={t("Hora de convocatoria (HH:mm)")} value={time} onChangeText={setTime} placeholder="21:50" maxLength={5} editable={!busy} />
    <Body>{t("Cerrar la votación automáticamente")}</Body>
    <Switch accessibilityLabel={t("Cierre automático de votación")} value={closingEnabled} onValueChange={setClosingEnabled} disabled={busy} />
    {closingEnabled ? <Field label={t("Hora de cierre de votación (HH:mm)")} value={closingTime} onChangeText={setClosingTime} maxLength={5} editable={!busy} /> : null}
    <Body>{t("Se usa la zona horaria de la convocatoria. Al cerrar ya no se podrán enviar ni cambiar votos.")}</Body>
    <Body>{t("Enviar un último aviso a quienes sigan sin responder")}</Body>
    <Switch accessibilityLabel={t("Enviar último aviso para votar")} value={noticeEnabled} onValueChange={setNoticeEnabled} disabled={busy} />
    {noticeEnabled ? <Field label={t("Último aviso para votar (HH:mm)")} value={noticeTime} onChangeText={setNoticeTime} maxLength={5} editable={!busy} /> : null}
    <Body>{t("Hora del club. Si el aviso ya ha pasado, se enviará en la próxima ejecución del servicio, antes de la convocatoria.")}</Body>
    <Body>{t("Programar valoración de jugadores")}</Body>
    <Switch accessibilityLabel={t("Programar valoración de jugadores")} value={evaluationEnabled} onValueChange={setEvaluationEnabled} disabled={busy} />
    {evaluationEnabled ? <><Field label={t("Hora de valoración (HH:mm)")} value={evaluationTime} onChangeText={setEvaluationTime} maxLength={5} editable={!busy} />
      <Body>{t("Hora del club. Si es anterior al partido, se usará el día siguiente. Solo los capitanes podrán valorar a partir de esa hora.")}</Body><Body>{t("A esa hora avisaremos a los capitanes para que valoren a los jugadores.")}</Body></> : null}
    {message ? <Message error>{message}</Message> : null}
    <Button label={t("Revisar convocatoria")} disabled={busy || isDemo} onPress={preview} />
    <ConfirmDialog visible={Boolean(instant)} title={t("Crear convocatoria abierta")} description={t("Partido el {{v0}} a las {{v1}}, en {{v2}}. {{v3}}{{v4}}{{v5}}", { v0: date, v1: time, v2: activeClub?.timezone, v5: (evaluationAt ? t("Valoraciones desde {{v0}}. ", { v0: new Date(evaluationAt).toLocaleString(intlLocale(), { timeZone: activeClub?.timezone ?? 'Europe/Madrid' }) }) : '') + t("Se respetarán las decisiones mantenidas; el resto comenzará sin responder. Las pruebas serán informativas."), v3: closingEnabled ? t("Cierre de votación a las {{v0}}. ", { v0: closingTime }) : t("Sin cierre automático. "), v4: noticeEnabled ? t("Último aviso para votar a las {{v0}}. ", { v0: noticeTime }) : t("Sin último aviso. ") })} busy={busy} confirmLabel={t("Crear convocatoria")} onCancel={() => setInstant(null)} onConfirm={() => { void submit(); }} />
  </Screen>;
}
