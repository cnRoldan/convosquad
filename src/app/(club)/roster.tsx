import { useCallback, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Button, Card, Heading, Message, Options, Screen } from '@/components/ui';
import { ReorderButtons } from '@/components/reorder-buttons';
import { useClub } from '@/features/clubs/club-context';
import { useAuth } from '@/features/auth/auth-context';
import { listPlayers, reorderPlayers } from '@/features/players/service';
import { categories, categoryLabels, compareRoster, moveItem } from '@/features/players/categories';
import type { RosterCategory } from '@/features/players/categories';
import { TrialSection } from '@/features/trials/trial-section';
import { useResource } from '@/hooks/use-resource';
import { backendErrorMessage } from '@/lib/backend-result';
export default function RosterScreen() {
  const { activeClub, currentMembership, roster, rosterVersion, notice, refreshRoster } = useClub();
  const { session, isDemo } = useAuth();
  const clubId = activeClub?.id; const admin = currentMembership?.role === 'admin';
  const [filter, setFilter] = useState<'all' | 'registered' | 'unregistered'>('all');
  const { activity } = useLocalSearchParams<{ activity?: string }>();
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const load = useCallback(() => clubId ? listPlayers(clubId) : Promise.resolve([]), [clubId]);
  const result = useResource(`players:${session?.user.id}:${clubId}:${admin}:${rosterVersion}`, load, Boolean(session && clubId) && !isDemo);
  const players = (isDemo ? roster.map(player => ({ ...player, isActive: true })) : result.data?.map(player => ({
    id: player.id, eaId: player.ea_id, displayName: player.ea_id, jerseyNumber: player.jersey_number,
    category: player.category, sortOrder: player.sort_order, userId: player.user_id, isActive: player.is_active,
  })) ?? []).sort(compareRoster);
  const displayed = players.filter(player => player.isActive && (filter === 'all' || (filter === 'registered' ? Boolean(player.userId) : !player.userId)));
  async function move(category: RosterCategory, id: string, direction: -1 | 1) {
    if (!clubId || isDemo || busy) return;
    const ids = moveItem(players.filter(player => player.category === category && player.isActive).map(player => player.id), id, direction); if (!ids) return;
    setBusy(true); setMessage('');
    try { await reorderPlayers(clubId, category, ids); refreshRoster(); }
    catch (error) { setMessage(backendErrorMessage(error)); result.reload(); }
    finally { setBusy(false); }
  }
  return <Screen>
    <Heading title="La plantilla" subtitle={activeClub?.name ?? 'Tu club'} />
    {notice ? <Message>{notice}</Message> : null}
    {activity === 'removed' ? <Message>Jugador quitado de la plantilla. Su cuenta y convocatorias anteriores se conservan.</Message> : null}
    {message ? <Message error>{message}</Message> : null}
    <Options value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'registered', label: 'Registrados' }, { value: 'unregistered', label: 'Sin registrar' }]} />
    {admin ? <>
      <Button secondary label="Jugadores inactivos" onPress={() => router.push('/inactive-players')} />
      <Button label="Añadir jugador" onPress={() => router.push('/players/new')} />
      <Button secondary label="Importar desde WhatsApp" onPress={() => router.push('/roster-import')} />
      {filter !== 'all' ? <Body>Para ordenar, muestra todos los jugadores activos.</Body> : null}
    </> : null}
    {result.isLoading ? <Body>Cargando plantilla…</Body> : null}
    {result.error ? <><Message error>{result.error}</Message><Button secondary label="Reintentar" onPress={result.reload} /></> : null}
    {categories.map(category => {
      const group = displayed.filter(player => player.category === category);
      return <Card key={category} title={categoryLabels[category]}>
        {category === 'backups' ? <Body>Miembros habituales de la plantilla. Su categoría no determina su respuesta a una convocatoria.</Body> : null}
        {group.map((player, index) => <Card key={player.id} title={player.displayName}>
          <Body>{player.jerseyNumber === null ? 'Sin dorsal' : `Dorsal ${player.jerseyNumber}`}</Body>
          <Body>EA ID: {player.eaId} · {player.userId ? 'Registrado' : 'Sin registrar'}{player.isActive ? '' : ' · Inactivo'}</Body>
          {admin ? <Button secondary label={`Editar ${player.displayName}`} onPress={() => router.push({ pathname: '/players/[id]', params: { id: player.id } })} /> : null}
          {admin && filter === 'all' ? <ReorderButtons label={player.eaId} first={index === 0} last={index === group.length - 1} disabled={busy || isDemo || result.isLoading} move={direction => { void move(category, player.id, direction); }} /> : null}
        </Card>)}
        {!group.length && !result.isLoading && !result.error ? <Body>Sin jugadores con este filtro.</Body> : null}
      </Card>;
    })}
    <TrialSection />
    {!isDemo ? <Button secondary label="Actualizar plantilla" disabled={result.isLoading} onPress={() => { result.reload(); refreshRoster(); }} /> : <Body>Datos simulados · los cambios de la demo no se guardan.</Body>}
  </Screen>;
}
