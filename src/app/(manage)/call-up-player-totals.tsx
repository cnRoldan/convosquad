import { Modal, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Body, Button, Card, Heading, Message, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { readClubPremium } from '@/features/clubs/service';
import { getCallUpPlayerTotals } from '@/features/call-ups/service';
import { t, useLanguage } from '@/features/i18n/runtime';
import { useResource } from '@/hooks/use-resource';

const preview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="760"><rect width="600" height="760" fill="#0B1210"/><rect x="20" y="20" width="560" height="165" rx="24" fill="#14241C" stroke="#384A3D"/><rect x="20" y="205" width="560" height="165" rx="24" fill="#14241C" stroke="#384A3D"/></svg>')}`;

export default function CallUpPlayerTotalsScreen() {
  useLanguage();
  const { activeClub } = useClub(); const { session, isDemo } = useAuth(); const clubId = activeClub?.id;
  const premium = useResource(`club-premium:${session?.user.id}:${clubId}`, () => clubId ? readClubPremium(clubId) : Promise.resolve(false), Boolean(session && clubId && !isDemo));
  const totals = useResource(`player-totals:${session?.user.id}:${clubId}`, () => clubId ? getCallUpPlayerTotals(clubId) : Promise.resolve([]), Boolean(session && clubId && premium.data && !isDemo));
  const back = () => requestAnimationFrame(() => router.replace('/call-up-history'));
  const players = [...(totals.data ?? [])].sort((a, b) => b.substitute_count - a.substitute_count || b.available_count + b.backup_count - (a.available_count + a.backup_count));
  return <Screen>
    <Heading title={t('Total por jugador')} subtitle={activeClub?.name ?? ''} />
    {premium.isLoading ? <Body>Comprobando acceso Prémium…</Body> : null}
    {premium.error ? <Message error>No se pudo comprobar el acceso Prémium.</Message> : null}
    {premium.data ? <>
      <Body>Las suplencias cuentan a quienes marcaron Disponible o Backup y no entraron en el once publicado.</Body>
      {totals.isLoading ? <Body>Cargando estadísticas…</Body> : null}
      {totals.error ? <Message error>No se pudieron cargar las estadísticas.</Message> : null}
      {players.map(player => <Card key={player.player_id} title={player.player_name}><Body>Suplencias: {player.substitute_count}</Body><Body>Disponibilidad: {player.available_count + player.backup_count} de {player.total_call_ups}</Body></Card>)}
      {!totals.isLoading && players.length === 0 ? <Body>Aún no hay convocatorias finalizadas con datos de jugadores.</Body> : null}
      <Button secondary label="Actualizar" onPress={totals.reload} />
    </> : <>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.preview}><Image source={{ uri: preview }} contentFit="cover" blurRadius={10} style={StyleSheet.absoluteFill} accessible={false} /><View style={styles.tint} /></View>
      <Modal transparent visible animationType="fade" onRequestClose={back}><View style={styles.overlay}><Card title={t('⭐ Funcionalidad Prémium')}><Body>Consulta disponibilidad, tiempos de respuesta y suplencias por jugador.</Body><Button label={t('Regresar')} onPress={back} /></Card></View></Modal>
    </>}
  </Screen>;
}
const styles = StyleSheet.create({ preview: { height: 560, borderRadius: 24, overflow: 'hidden' }, tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(9,18,14,0.35)' }, overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(3,8,6,0.48)' } });
