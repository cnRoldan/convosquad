import { t, useLanguage } from '@/features/i18n/runtime';
import { Text } from 'react-native';
import { jerseyAccessibilityLabel, jerseyLabel } from '@/features/players/jersey';
import { useCallback } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, DemoNotice, Heading, Message, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useClub } from '@/features/clubs/club-context';
import { listInactivePlayers } from '@/features/players/service';
import { categoryLabels } from '@/features/players/categories';
import { useResource } from '@/hooks/use-resource';

export default function InactivePlayersScreen() {
  useLanguage();
  const { session, isDemo } = useAuth();
  const { activeClub, currentMembership, rosterVersion } = useClub();
  const { activity } = useLocalSearchParams<{ activity?: string }>();
  const clubId = activeClub?.id;
  const admin = currentMembership?.role === 'admin';
  const load = useCallback(() => clubId ? listInactivePlayers(clubId) : Promise.resolve([]), [clubId]);
  const result = useResource(`inactive-players:${session?.user.id}:${clubId}:${rosterVersion}`, load, Boolean(session && clubId && admin) && !isDemo);
  return <Screen>
    <Heading title={t("Jugadores inactivos")} subtitle={activeClub?.name ?? ''} />
    <Body>{t("Estas fichas conservan sus datos, cuenta vinculada y convocatorias anteriores. No se incluyen en nuevas convocatorias.")}</Body>
    {isDemo ? <DemoNotice /> : null}
    {activity === 'restored' ? <Message>{t("Jugador reincorporado a la plantilla con sus datos conservados. Las convocatorias existentes no cambian.")}</Message> : null}
    {result.isLoading ? <Body>{t("Cargando jugadores inactivos…")}</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button secondary label={t("Reintentar")} onPress={result.reload} /></> : null}
    {result.data?.map(player => <Card key={player.id} title={player.ea_id}>
      <Body>{t(categoryLabels[player.category])} · <Text accessibilityLabel={jerseyAccessibilityLabel(player.jersey_number)}>{jerseyLabel(player.jersey_number)}</Text></Body>
      <Body>{player.user_id ? t("Registrado · cuenta vinculada") : t("Sin registrar")} {t("· Inactivo")}</Body>
      <Button secondary label={t("Consultar y reincorporar {{v0}}", { v0: player.ea_id })} onPress={() => router.push({ pathname: '/players/[id]', params: { id: player.id } })} />
    </Card>)}
    {result.data?.length === 0 ? <Body>{t("No hay jugadores inactivos en este club.")}</Body> : null}
    {!isDemo ? <Button secondary label={t("Actualizar")} disabled={result.isLoading} onPress={result.reload} /> : <Body>{t("La demo no contiene jugadores inactivos ni permite guardar cambios.")}</Body>}
    <Button secondary label={t("Volver a la plantilla")} onPress={() => router.replace('/roster')} />
  </Screen>;
}
