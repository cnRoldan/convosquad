import { useCallback, useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Heading, Message, Screen } from '@/components/ui';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { readPushIntent, notificationDestination } from '@/features/notifications/intent';
import { usePendingPush } from '@/features/notifications/pending-push-context';
import { getCallUp } from '@/features/call-ups/service';
import { useResource } from '@/hooks/use-resource';
export default function NotificationScreen() {
  const params = useLocalSearchParams<{ club?: string; call?: string }>();
  const { session, isDemo, isLoading, exitDemo, isRecovery } = useAuth(); const { availableClubs, isLoading: loadingClubs, selectClub, error: clubError, refresh } = useClub();
  const { pendingPush, rememberPush, clearPush } = usePendingPush();
  const incoming = readPushIntent({ type: 'call_up', clubId: params.club, callUpId: params.call });
  const intent = params.club || params.call ? incoming : pendingPush;
  const member = Boolean(intent && availableClubs.some(club => club.id === intent.clubId));
  const opened = useRef<string | null>(null);
  const clubId = intent?.clubId; const callUpId = intent?.callUpId;
  const load = useCallback(async () => {
    if (!clubId || !callUpId) return null;
    try { return await getCallUp(clubId, callUpId); }
    catch { return null; }
  }, [clubId, callUpId]);
  const call = useResource(`push-link:${session?.user.id}:${intent?.clubId}:${intent?.callUpId}`, load, Boolean(session && member && !isDemo && !isRecovery));
  const destination = intent ? notificationDestination(intent, Boolean(session && !isDemo), availableClubs, call.data) : 'unavailable';
  function login() { if (intent) { rememberPush(intent); exitDemo(); router.replace(isRecovery ? '/reset-password' : '/login'); } }
  useEffect(() => {
    if (!clubId || !callUpId || destination !== 'call-up' || isRecovery) return;
    const key = `${session?.user.id}:${clubId}:${callUpId}`; if (opened.current === key) return; opened.current = key;
    selectClub(clubId); clearPush(); router.replace({ pathname: '/call-up', params: { id: callUpId } });
  }, [clubId, callUpId, destination, isRecovery, selectClub, clearPush, session?.user.id]);
  if (isLoading || loadingClubs || call.isLoading) return <LoadingScreen label="Comprobando acceso a la convocatoria…" />;
  if (clubError) return <Screen><Message error>No se pudo comprobar el club. Comprueba tu conexión.</Message><Button label="Reintentar" onPress={refresh} /></Screen>;
  return <Screen>
    <Heading title="Aviso de convocatoria" />
    {destination === 'login' ? <><Body>Inicia sesión para comprobar el club y continuar.</Body><Button label="Iniciar sesión y continuar" onPress={login} /></>
      : isRecovery ? <><Message>Completa la recuperación de tu cuenta antes de continuar.</Message><Button label="Continuar recuperación" onPress={login} /></>
      : destination === 'no-membership' ? <Message error>Ya no perteneces al club de esta convocatoria o no tienes acceso.</Message>
      : destination === 'cancelled' ? <Message>Esta convocatoria se ha cancelado.</Message>
      : destination !== 'call-up' ? <><Message>La convocatoria puede haberse cancelado o cerrado, o ya no tienes acceso. También puede haber un problema de conexión.</Message><Button secondary label="Reintentar" onPress={call.reload} /></>
      : <><Body>Convocatoria verificada. Al abrirla cambiarás al club correspondiente.</Body><LoadingScreen label="Abriendo convocatoria…" /></>}
    <Button secondary label="Cerrar aviso" onPress={() => { clearPush(); router.replace(session && !isDemo ? '/clubs' : '/'); }} />
  </Screen>;
}
