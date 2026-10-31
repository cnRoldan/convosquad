import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Body, Button, Card, Heading, Message, Options, Screen } from '@/components/ui';
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
  const [sort, setSort] = useState<'available' | 'least-available' | 'substitutes' | 'pending' | 'slowest' | 'streak'>('available');
  const premium = useResource(`club-premium:${session?.user.id}:${clubId}`, () => clubId ? readClubPremium(clubId) : Promise.resolve(false), Boolean(session && clubId && !isDemo));
  const totals = useResource(`player-totals:${session?.user.id}:${clubId}`, () => clubId ? getCallUpPlayerTotals(clubId) : Promise.resolve([]), Boolean(session && clubId && premium.data && !isDemo));
  const back = () => requestAnimationFrame(() => router.replace('/call-up-history'));
  const players = [...(totals.data ?? [])].sort((a, b) => {
    const availability = (player: typeof a) => player.available_count + player.backup_count;
    const response = (player: typeof a) => player.average_response_seconds ?? -1;
    const difference = sort === 'available' ? availability(b) - availability(a) : sort === 'least-available' ? availability(a) - availability(b)
      : sort === 'substitutes' ? b.substitute_count - a.substitute_count : sort === 'pending' ? b.pending_non_backup_count - a.pending_non_backup_count
        : sort === 'slowest' ? response(b) - response(a) : b.longest_unavailable_streak - a.longest_unavailable_streak;
    return difference || a.player_name.localeCompare(b.player_name);
  });
  return <Screen>
    <Heading title={t('Total por jugador')} subtitle={activeClub?.name ?? ''} />
    {premium.isLoading ? <Body>Comprobando acceso Prémium…</Body> : null}
    {premium.error ? <Message error>No se pudo comprobar el acceso Prémium.</Message> : null}
    {premium.data ? <>
      <Body>Las suplencias cuentan a quienes marcaron Disponible o Backup y no entraron en el once publicado.</Body>
      <Options value={sort} onChange={setSort} options={[{ value: 'available', label: 'Más disponibles' }, { value: 'least-available', label: 'Menos disponibles' }, { value: 'substitutes', label: 'Más suplencias' }, { value: 'pending', label: 'Más pendientes' }, { value: 'slowest', label: 'Más lentos' }, { value: 'streak', label: 'Mayor racha' }]} />
      {totals.isLoading ? <Body>Cargando estadísticas…</Body> : null}
      {totals.error ? <Message error>No se pudieron cargar las estadísticas.</Message> : null}
      {players.map(player => <Card key={player.player_id} title={player.player_name}><Body>Suplencias: {player.substitute_count}</Body><Body>Disponibilidad: {player.available_count + player.backup_count} de {player.total_call_ups}</Body><Body>Pendientes (sin ser backup): {player.pending_non_backup_count}</Body><Body>Mayor racha sin estar disponible: {player.longest_unavailable_streak}</Body><Body>Tiempo medio de respuesta: {formatResponseTime(player.average_response_seconds)}</Body></Card>)}
      {!totals.isLoading && players.length === 0 ? <Body>Aún no hay convocatorias finalizadas con datos de jugadores.</Body> : null}
      <Button secondary label="Actualizar" onPress={totals.reload} />
    </> : <>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.preview}><Image source={{ uri: preview }} contentFit="cover" blurRadius={10} style={StyleSheet.absoluteFill} accessible={false} /><View style={styles.tint} /></View>
      <Modal transparent visible animationType="fade" onRequestClose={back}><View style={styles.overlay}><Card title={t('⭐ Funcionalidad Prémium')}><Body>Consulta disponibilidad, tiempos de respuesta y suplencias por jugador.</Body><Button label={t('Regresar')} onPress={back} /></Card></View></Modal>
    </>}
  </Screen>;
}
const styles = StyleSheet.create({ preview: { height: 560, borderRadius: 24, overflow: 'hidden' }, tint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(9,18,14,0.35)' }, overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(3,8,6,0.48)' } });

function formatResponseTime(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return 'Sin datos';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}
