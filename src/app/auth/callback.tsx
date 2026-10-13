import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Heading, Screen } from '@/components/ui';
import { requireSupabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/auth-context';
import { usePendingInvite } from '@/features/invitations/pending-invite-context';

export default function AuthCallbackScreen() {
  const { exitDemo, getRecoveryMode } = useAuth();
  const { pendingInvite } = usePendingInvite();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const handled = useRef<string | null>(null);
  const [message, setMessage] = useState('Comprobando el enlace de acceso…');
  useEffect(() => {
    if (!code || typeof code !== 'string') return;
    if (handled.current === code) return;
    handled.current = code;
    void (async () => {
      try {
        const { error } = await requireSupabase().auth.exchangeCodeForSession(code);
        if (error) throw error;
        exitDemo();
        router.replace(getRecoveryMode() ? '/reset-password' : pendingInvite ? '/invite' : { pathname: '/clubs', params: { auto: '1' } });
      } catch {
        setMessage('El enlace no se pudo verificar. Puede haber caducado o haberse abierto en otro dispositivo.');
      }
    })();
  }, [code, exitDemo, pendingInvite, getRecoveryMode]);
  return <Screen>
    <Heading title="Verificar tu cuenta" />
    <Body>{code && typeof code === 'string' ? message : 'El enlace no contiene un código válido. Intenta iniciar sesión o solicita un nuevo enlace.'}</Body>
    <Button secondary label="Volver al acceso" onPress={() => router.replace('/login')} />
  </Screen>;
}
