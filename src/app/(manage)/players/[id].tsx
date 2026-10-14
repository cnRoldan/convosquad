import { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Message, Screen } from '@/components/ui';
import { LoadingScreen } from '@/components/loading';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { getPlayer } from '@/features/players/service';
import { PlayerEditor } from '@/features/players/player-editor';
import { useResource } from '@/hooks/use-resource';

export default function EditPlayerScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, isDemo } = useAuth();
  const { activeClub, roster } = useClub();
  const clubId = activeClub?.id;
  const load = useCallback(async () => {
    if (!clubId || typeof id !== 'string') return null;
    return getPlayer(clubId, id);
  }, [clubId, id]);
  const result = useResource(`player:${session?.user.id}:${clubId}:${id}`, load, Boolean(clubId && session && typeof id === 'string') && !isDemo);
  const demoPlayer = isDemo ? roster.find((player) => player.id === id) : null;
  const player = demoPlayer ? { ...demoPlayer, isActive: true } : result.data ? {
    id: result.data.id, eaId: result.data.ea_id, jerseyNumber: result.data.jersey_number, category: result.data.category,
    userId: result.data.user_id, isActive: result.data.is_active,
  } : null;
  if (result.isLoading) return <LoadingScreen label="Cargando ficha…" />;
  if (!player) return <Screen>
    <Message error>{result.error ?? 'La ficha no existe en este club.'}</Message>
    <Button secondary label="Volver a la plantilla" onPress={() => router.replace('/roster')} />
    {!isDemo ? <Button secondary label="Reintentar" onPress={result.reload} /> : <Body>La demo solo permite abrir sus fichas de ejemplo.</Body>}
  </Screen>;
  return <PlayerEditor key={`${session?.user.id}:${clubId}:${player.id}`} player={player} />;
}
