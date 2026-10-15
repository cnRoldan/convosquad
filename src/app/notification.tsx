import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Heading, Message, Screen } from '@/components/ui';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { readPushIntent, notificationDestination } from '@/features/notifications/intent';
import { usePendingPush } from '@/features/notifications/pending-push-context';
import { availabilityLabels, callUpErrorMessage } from '@/features/call-ups/availability';
import { getCallUp, respondFromNotification } from '@/features/call-ups/service';
import { useResource } from '@/hooks/use-resource';
export default function NotificationScreen() {
  const params = useLocalSearchParams<{ club?: string; call?: string }>();
  const { session, isDemo, isLoading, exitDemo, isRecovery } = useAuth(); const { availableClubs, isLoading: loadingClubs, selectClub, error: clubError, refresh } = useClub();
  const { pendingPush, rememberPush, clearPush } = usePendingPush();
  const incoming = readPushIntent({ type: 'call_up', clubId: params.club, callUpId: params.call });
  const intent = params.club || params.call ? incoming : pendingPush;
  const member = Boolean(intent && availableClubs.some(club => club.id === intent.clubId));
  const opened = useRef<string | null>(null);
  const [actionResult, setActionResult] = useState<{ key: string; text: string; error: boolean } | null>(null);
  const clubId = intent?.clubId; const callUpId = intent?.callUpId;
  const load = useCallback(async () => {
    if (!clubId || !callUpId) return null;
    try { return await getCallUp(clubId, callUpId); }
    catch { return null; }
  }, [clubId, callUpId]);
  const call = useResource(`push-link:${session?.user.id}:${intent?.clubId}:${intent?.callUpId}`, load, Boolean(session && member && !isDemo && !isRecovery));
  const destination = intent ? notificationDestination(intent, Boolean(session && !isDemo), availableClubs, call.data) : 'unavailable';
  const response = intent?.response;
  const wrongAccount = Boolean(response && session && response.userId !== session.user.id);
  const closed = Boolean(response && call.data && call.data.status !== 'open');
  const actionKey = `${session?.user.id}:${response?.actionId}`;
  const result = actionResult?.key === actionKey ? actionResult : null;
  function login() { if (intent) { rememberPush(intent); exitDemo(); router.replace(isRecovery ? '/reset-password' : '/login'); } }
  useEffect(() => {
    if (!clubId || !callUpId || destination !== 'call-up' || isRecovery) return;
    const key = `${session?.user.id}:${clubId}:${callUpId}:${intent?.response?.actionId ?? "open"}`; if (opened.current === key) return; opened.current = key;
    const response = intent?.response;
    if (response) {
      if (wrongAccount || closed) return;
      void respondFromNotification(clubId, callUpId, response.availability, response.actionId).then(result => {
        setActionResult({ key: actionKey, text: `Tu respuesta: ${availabilityLabels[result.availability]}.`, error: false });
      }).catch(error => { setActionResult({ key: actionKey, text: callUpErrorMessage(error), error: true }); });
      return;
    }
    selectClub(clubId); clearPush(); router.replace({ pathname: '/call-up', params: { id: callUpId } });
  }, [clubId, callUpId, destination, isRecovery, selectClub, clearPush, session?.user.id, intent?.response, call.data?.status, wrongAccount, closed, actionKey]);
  if (!result && (isLoading || loadingClubs || call.isLoading)) return <LoadingScreen label="Comprobando acceso a la convocatoria…" />;
  if (clubError) return <Screen><Message error>No se pudo comprobar el club. Comprueba tu conexión.</Message><Button label="Reintentar" onPress={refresh} /></Screen>;
  return <Screen>
    <Heading title="Aviso de convocatoria" />
    {result ? <><Message error={result.error}>{result.text}</Message><Button label="Abrir convocatoria" onPress={() => { if (clubId && callUpId) { selectClub(clubId); clearPush(); router.replace({ pathname: '/call-up', params: { id: callUpId } }); } }} /></>
      : wrongAccount ? <Message error>Este aviso pertenece a otra cuenta. Abre la convocatoria con tu cuenta para responder.</Message>
      : closed ? <Message>Esta convocatoria está cerrada. No puedes modificar tu voto.</Message>
      : response && destination === 'call-up' ? <Body>Guardando tu respuesta…</Body>
      : destination === 'login' ? <><Body>Inicia sesión para comprobar el club y continuar.</Body><Button label="Iniciar sesión y continuar" onPress={login} /></>
      : isRecovery ? <><Message>Completa la recuperación de tu cuenta antes de continuar.</Message><Button label="Continuar recuperación" onPress={login} /></>
      : destination === 'no-membership' ? <Message error>Ya no perteneces al club de esta convocatoria o no tienes acceso.</Message>
      : destination === 'cancelled' ? <Message>Esta convocatoria se ha cancelado.</Message>
      : destination !== 'call-up' ? <><Message>La convocatoria puede haberse cancelado o cerrado, o ya no tienes acceso. También puede haber un problema de conexión.</Message><Button secondary label="Reintentar" onPress={call.reload} /></>
      : <><Body>Convocatoria verificada. Al abrirla cambiarás al club correspondiente.</Body><LoadingScreen label="Abriendo convocatoria…" /></>}
    <Button secondary label="Cerrar aviso" onPress={() => { clearPush(); router.replace(session && !isDemo ? '/clubs' : '/'); }} />
  </Screen>;
}
