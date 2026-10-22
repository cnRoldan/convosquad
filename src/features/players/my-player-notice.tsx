import { router } from 'expo-router';
import { Body, Button, Card } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { t, useLanguage } from '@/features/i18n/runtime';

export function MyPlayerNotice() {
  useLanguage();
  const { session, isDemo } = useAuth();
  const { activeClub, currentMembership, roster, rosterLoading, rosterError } = useClub();
  if (isDemo || !session || !activeClub || currentMembership?.role !== 'admin' || rosterLoading || rosterError
    || roster.some(player => player.userId === session.user.id)) return null;
  return <Card title={t('Aún no cuentas con ficha de jugador en plantilla')}>
    <Body>{t('Crea tu ficha para aparecer como jugador y poder votar en las convocatorias de este club.')}</Body>
    <Button label={t('Crear mi ficha')} onPress={() => router.push({ pathname: '/players/new', params: { self: '1' } })} />
  </Card>;
}
