import { useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Body, Button, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { getClubCrestUrl } from '@/features/clubs/crest';
import { t, useLanguage } from '@/features/i18n/runtime';
import { useResource } from '@/hooks/use-resource';
import { LineupShareCard } from './share-card';
import { readPublishedLineup } from './service';

export function PublishedLineupView() {
  useLanguage();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useAuth();
  const { activeClub } = useClub();
  const load = useCallback(async () => {
    const result = await readPublishedLineup(id!);
    const crestUrl = result.snapshot?.crestPath ? await getClubCrestUrl(result.snapshot.crestPath) : null;
    return { ...result, crestUrl };
  }, [id]);
  const result = useResource(`published-lineup:${session?.user.id}:${activeClub?.id}:${id}`, load, Boolean(session && activeClub && id));
  const reload = result.reload;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return <Screen compact onRefresh={result.reload} refreshing={result.isLoading}>
    {result.isLoading ? <Body>{t('Cargando alineación…')}</Body> : result.error ? <><Message error>{t(result.error)}</Message><Button secondary label={t('Reintentar')} onPress={result.reload} /></>
      : result.data?.snapshot ? <View testID="published-lineup-image" accessible accessibilityRole="image" accessibilityLabel={t('Imagen del once publicado')} pointerEvents="none">
        <LineupShareCard {...result.data.snapshot} crestUrl={result.data.crestUrl} />
      </View> : <Body>{t(result.data?.allowed === false ? 'La imagen de esta alineación histórica no está disponible para el club.' : 'El capitán todavía no ha publicado el once.')}</Body>}
  </Screen>;
}
