import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Body, Button, Heading, Screen } from '@/components/ui';
import { requireSupabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/auth-context';
import { authErrorMessage } from '@/features/auth/errors';
import { completeAuthLink, readAuthLink } from '@/features/auth/callback';
import { usePendingInvite } from '@/features/invitations/pending-invite-context';

const subscribe = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function AuthCallbackScreen() {
  const { exitDemo } = useAuth();
  const { pendingInvite } = usePendingInvite();
  const incomingUrl = Linking.useURL();
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const url = hydrated && Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : incomingUrl;
  const link = useMemo(() => readAuthLink(url), [url]);
  const handled = useRef<string | null>(null);
  const [attemptedUrl, setAttemptedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Comprobando el enlace de acceso…');

  const verify = useCallback(async () => {
    if (!url || handled.current === url) return;
    handled.current = url;
    setAttemptedUrl(url);
    setMessage('Comprobando el enlace de acceso…');
    setBusy(true);
    try {
      const result = await completeAuthLink(requireSupabase().auth, link);
      exitDemo();
      // Clear credentials before navigating, preserving the destination's parameters.
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState(window.history.state, '', window.location.pathname);
      router.replace(result.recovery ? '/reset-password' : pendingInvite ? '/invite' : { pathname: '/clubs', params: { auto: '1' } });
    } catch (error) {
      setMessage(authErrorMessage(error, 'callback'));
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.history.replaceState(window.history.state, '', window.location.pathname);
    } finally { setBusy(false); }
  }, [url, link, exitDemo, pendingInvite]);

  useEffect(() => {
    if (!hydrated || !url) return;
    // The ref guards duplicate exchanges, including Strict Mode effect re-runs.
    if (link.kind === 'pkce') void Promise.resolve().then(verify);
  }, [hydrated, url, link, verify]);

  const waitingForOtp = link.kind === 'otp' && attemptedUrl !== url;
  return <Screen>
    <Heading title="Verificar tu cuenta" />
    <Body>{link.kind === 'error' ? authErrorMessage({ code: link.code }, 'callback') : waitingForOtp ? 'Pulsa para verificar el enlace del correo y continuar.' : hydrated && link.kind === 'invalid' && !attemptedUrl ? 'El enlace no contiene un código válido. Intenta iniciar sesión o solicita un nuevo enlace.' : message}</Body>
    {waitingForOtp ? <Button label={busy ? 'Comprobando…' : 'Verificar enlace'} disabled={busy} onPress={() => { void verify(); }} /> : null}
    <Button secondary disabled={busy} label="Recuperar acceso o usar un código" onPress={() => router.replace('/recover')} />
    <Button secondary disabled={busy} label="Volver al acceso" onPress={() => router.replace('/login')} />
  </Screen>;
}
