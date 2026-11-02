import { router } from 'expo-router';
import { Body, Button, Card } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { t, useLanguage } from '@/features/i18n/runtime';

export function MyPlayerNotice() {
  useLanguage();
  const { session, isDemo } = useAuth();
  const { activeClub, currentMembership, roster, rosterLoading, rosterError } = useClub();
  if (isDemo || !session || !activeClub || !currentMembership || rosterLoading || rosterError
    || roster.some(player => player.userId === session.user.id)) return null;
  return <Card title={t('Aún no cuentas con ficha de jugador en plantilla')}>
    <Body>{currentMembership.role === 'admin' ? t('Crea tu ficha para aparecer como jugador y poder votar en las convocatorias de este club.') : 'Completa tu ficha o vincúlala con una existente para participar en las convocatorias.'}</Body>
    <Button label={currentMembership.role === 'admin' ? t('Crear mi ficha') : 'Completar o vincular mi ficha'} onPress={() => router.push(currentMembership.role === 'admin' ? { pathname: '/players/new', params: { self: '1' } } : { pathname: '/complete-player', params: { club: activeClub.id } })} />
  </Card>;
}
