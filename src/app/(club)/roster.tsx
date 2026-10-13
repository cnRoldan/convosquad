import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { Switch, View } from 'react-native';
import { Body, Button, Card, Heading, Message, Options, Screen } from '@/components/ui';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { listPlayers } from '@/features/players/service';
import { useResource } from '@/hooks/use-resource';

export default function RosterScreen() {
  const { activeClub, currentMembership, roster, rosterVersion, notice } = useClub();
  const { session, isDemo } = useAuth();
  const clubId = activeClub?.id;
  const admin = currentMembership?.role === 'admin';
  const [filter, setFilter] = useState<'all' | 'registered' | 'unregistered'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const load = useCallback(() => clubId ? listPlayers(clubId, admin) : Promise.resolve([]), [clubId, admin]);
  const result = useResource(`players:${session?.user.id}:${clubId}:${admin}:${rosterVersion}`, load, Boolean(session && clubId) && !isDemo);
  const players = isDemo ? roster.map((player) => ({ id: player.id, eaId: player.eaId, displayName: player.displayName,
    jerseyNumber: player.jerseyNumber, position: player.position, userId: player.userId, isActive: true }))
    : result.data?.map((player) => ({ id: player.id, eaId: player.ea_id, displayName: player.ea_id,
      jerseyNumber: player.jersey_number, position: player.position, userId: player.user_id, isActive: player.is_active })) ?? [];
  const displayed = players.filter((player) => (showInactive || player.isActive) && (filter === 'all' || (filter === 'registered' ? Boolean(player.userId) : !player.userId)))
    .sort((a, b) => (a.jerseyNumber ?? 100) - (b.jerseyNumber ?? 100) || a.eaId.localeCompare(b.eaId, 'es'));
  return <Screen>
    <Heading title="La plantilla" subtitle={activeClub?.name ?? 'Tu club'} />
    {notice ? <Message>{notice}</Message> : null}
    <Options value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'registered', label: 'Registrados' }, { value: 'unregistered', label: 'Sin registrar' }]} />
    {admin ? <>
      <View style={{ gap: 8 }}><Body>Mostrar jugadores inactivos</Body><Switch accessibilityLabel="Mostrar jugadores inactivos" value={showInactive} onValueChange={setShowInactive} /></View>
      <Button label="Añadir jugador" onPress={() => router.push('/players/new')} />
      <Button secondary label="Importar desde WhatsApp" onPress={() => router.push('/roster-import')} />
    </> : null}
    {result.isLoading ? <Body>Cargando plantilla…</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button secondary label="Reintentar" onPress={result.reload} /></> : null}
    {displayed.map((player) => <Card key={player.id} title={player.displayName}>
      <Body>{player.jerseyNumber === null ? 'Sin dorsal' : `Dorsal ${player.jerseyNumber}`} · {player.position}</Body>
      <Body>EA ID: {player.eaId}</Body>
      <Body>{player.userId ? 'Registrado' : 'Sin registrar'}{player.isActive ? '' : ' · Inactivo'}</Body>
      {admin ? <Button secondary label={`Editar ${player.displayName}`} onPress={() => router.push({ pathname: '/players/[id]', params: { id: player.id } })} /> : null}
    </Card>)}
    {!displayed.length && !result.isLoading && !result.error ? <Body>No hay jugadores con este filtro.</Body> : null}
    {!isDemo ? <Button secondary label="Actualizar plantilla" disabled={result.isLoading} onPress={result.reload} /> : <Body>Datos simulados · los cambios de la demo no se guardan.</Body>}
  </Screen>;
}
